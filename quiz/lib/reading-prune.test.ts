import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import test, { afterEach } from "node:test"
import { deletePrivateReading, privateReadingRoot, readPrivateReadings, savePrivateReading } from "./private-reading.ts"
import { LISTING_VERSION, manifestFile, writeManifest, type Manifest } from "./reading-crawl.ts"
import { pruneCourse, pruneFinishedCourses, staleRecords } from "./reading-prune.ts"
import { testRoot } from "./test-pack.ts"

const before = process.env.QUIZ_PRIVATE_DIR
let scratch = ""

afterEach(async () => {
  if (before === undefined) delete process.env.QUIZ_PRIVATE_DIR
  else process.env.QUIZ_PRIVATE_DIR = before
  if (scratch) await rm(scratch, { recursive: true, force: true })
  scratch = ""
})

async function useScratch(): Promise<void> {
  scratch = await mkdtemp(path.join(tmpdir(), "reading-prune-"))
  process.env.QUIZ_PRIVATE_DIR = path.join(scratch, "store")
}

const lesson = (pageId: string, title: string) => ({ title, href: `/course_templates/1/html_bundles/${pageId}`, pageId, hash: "h" })
const manifest = (over: Partial<Manifest>): Manifest => ({ checkedAt: "2026-11-13T00:00:00.000Z", listing: LISTING_VERSION, complete: true, lessons: [lesson("1", "Kept")], ...over })

async function seed(): Promise<void> {
  await savePrivateReading("agentic-architect", "1", { pageId: "1", title: "Kept", text: "Synthetic kept text." })
  await savePrivateReading("agentic-architect", "1", { pageId: "2", title: "Removed by Google", text: "Synthetic gone text." })
}
const write = (value: Manifest) => writeManifest(manifestFile(privateReadingRoot(), "agentic-architect", "1"), value)
const titles = async () => (await readPrivateReadings("agentic-architect", "1")).map((record) => record.title)

test("a saved copy is stale only when the manifest no longer lists its page", async () => {
  await useScratch()
  await seed()
  const saved = await readPrivateReadings("agentic-architect", "1")
  assert.deepEqual(staleRecords(saved, manifest({})).map((record) => record.title), ["Removed by Google"])
  assert.deepEqual(staleRecords(saved, manifest({ lessons: [lesson("1", "Kept"), lesson("2", "Removed by Google")] })), [])
})

test("pruning a finished course removes the stale copy, names its title and keeps the rest; a dry run removes nothing", async () => {
  await useScratch()
  await seed()
  await write(manifest({}))
  const dry = await pruneCourse("agentic-architect", "1", { dryRun: true })
  assert.deepEqual(dry, { removed: ["Removed by Google"] })
  assert.deepEqual(await titles(), ["Kept", "Removed by Google"])
  const real = await pruneCourse("agentic-architect", "1")
  assert.deepEqual(real, { removed: ["Removed by Google"] })
  assert.deepEqual(await titles(), ["Kept"])
  assert.deepEqual(await pruneCourse("agentic-architect", "1"), { removed: [] }, "a second run finds nothing")
})

test("a manifest that cannot be trusted prunes nothing and says why", async () => {
  await useScratch()
  await seed()
  assert.match((await pruneCourse("agentic-architect", "1")).skipped ?? "", /no manifest yet/)
  await write(manifest({ complete: undefined }))
  assert.match((await pruneCourse("agentic-architect", "1")).skipped ?? "", /before automatic pruning existed/)
  await write(manifest({ complete: false }))
  assert.match((await pruneCourse("agentic-architect", "1")).skipped ?? "", /did not finish, its lesson list was still changing, or a card could not be read/)
  await write(manifest({ listing: LISTING_VERSION - 1 }))
  assert.match((await pruneCourse("agentic-architect", "1")).skipped ?? "", /older listing rule/)
  await write(manifest({ lessons: [lesson("1", "Kept"), { ...lesson("2", "No id"), pageId: "" }] }))
  assert.match((await pruneCourse("agentic-architect", "1")).skipped ?? "", /no page id/)
  await write(manifest({ lessons: [] }))
  assert.match((await pruneCourse("agentic-architect", "1")).skipped ?? "", /lists no lessons/)
  assert.deepEqual(await titles(), ["Kept", "Removed by Google"], "every copy is still there")
})

test("deleting one saved page says whether it was there and leaves the others", async () => {
  await useScratch()
  await seed()
  assert.equal(await deletePrivateReading("agentic-architect", "1", "2"), true)
  assert.equal(await deletePrivateReading("agentic-architect", "1", "2"), false)
  assert.deepEqual(await titles(), ["Kept"])
  await assert.rejects(() => deletePrivateReading("agentic-architect", "1", "../x"), /page id is invalid/)
})

test("the reading:prune command names the exam, takes --dry-run and refuses an unknown exam", async () => {
  await useScratch()
  const run = (...args: string[]) => spawnSync(process.execPath, ["scripts/reading-prune.mts", ...args], {
    cwd: path.join(testRoot, "quiz"), env: { ...process.env, QUIZ_PRIVATE_DIR: process.env.QUIZ_PRIVATE_DIR }, encoding: "utf8",
  })
  const unknown = run("no-such-exam")
  assert.equal(unknown.status, 2)
  assert.match(unknown.stderr, /Usage: pnpm reading:prune \[<exam>\|all\] \[--dry-run\]\. Known exams: /)
  const dry = run("agentic-architect", "--dry-run")
  assert.equal(dry.status, 0, dry.stderr)
  assert.match(dry.stdout, /agentic-architect 1\. .*: skipped, no manifest yet/)
  assert.match(dry.stdout, /Would remove 0 saved lesson\(s\) in all\./)
})

test("one course whose prune fails is reported with its error and the others are still pruned", async () => {
  const seen: string[] = []
  const done = await pruneFinishedCourses(
    [{ examId: "e", courseId: "1" }, { examId: "e", courseId: "2" }, { examId: "e", courseId: "3" }],
    async (_exam, course) => {
      seen.push(course)
      if (course === "2") throw new Error("permission denied")
      return { removed: [`gone ${course}`] }
    },
  )
  assert.deepEqual(seen, ["1", "2", "3"], "every course was tried")
  assert.deepEqual(done.map((entry) => entry.error ?? entry.removed.join()), ["gone 1", "permission denied", "gone 3"])
})
