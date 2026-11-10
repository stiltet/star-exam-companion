import assert from "node:assert/strict"
import { mkdir, mkdtemp, readFile, readdir, rm, stat, symlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import test, { afterEach } from "node:test"
import { MAX_RECORDS_PER_COURSE, PrivateStoreLimitError, allPrivateReadings, isPrivateReadingInput, privateReadingRoot, readPrivateReadings, savePrivateReading } from "./private-reading.ts"
import { privateReadingProvider } from "./reading-provider.ts"
import { loadPack } from "./pack.ts"
import { reading } from "./reading.ts"
import { buildRecording } from "./night-build.ts"
import { nightParts, wavFromPcm } from "./night.ts"
import { testRoot } from "./test-pack.ts"

const before = process.env.QUIZ_PRIVATE_DIR
let scratch = ""

afterEach(async () => {
  if (before === undefined) delete process.env.QUIZ_PRIVATE_DIR
  else process.env.QUIZ_PRIVATE_DIR = before
  if (scratch) await rm(scratch, { recursive: true, force: true })
  scratch = ""
})

async function useScratch(): Promise<string> {
  scratch = await mkdtemp(path.join(tmpdir(), "private-reading-"))
  const root = path.join(scratch, "outside-repo")
  process.env.QUIZ_PRIVATE_DIR = root
  return root
}

test("private readings are isolated by pack and course and kept outside the repository", async () => {
  const root = await useScratch()
  const stored = await savePrivateReading("agentic-architect", "12", { pageId: "101", title: "Synthetic title", text: "Synthetic fixture text." })
  assert.equal(privateReadingRoot(), root)
  assert.equal((await readPrivateReadings("agentic-architect", "12")).length, 1)
  assert.deepEqual(await readPrivateReadings("agentic-architect", "13"), [])
  assert.deepEqual(await readPrivateReadings("generative-ai-leader", "12"), [])
  assert.equal((await readPrivateReadings("agentic-architect", "12"))[0]?.text, "Synthetic fixture text.")
  assert.equal(path.relative(testRoot, root).startsWith(".."), true)
  assert.match(stored.savedAt, /^\d{4}-\d\d-\d\dT/)
})

test("the private provider turns a saved page into a Read Aloud page", async () => {
  await useScratch()
  const course = loadPack(testRoot, "agentic-architect").courses.find((entry) => entry.provider === "private")
  assert.ok(course)
  await savePrivateReading(course.packId, course.id, {
    pageId: "101",
    title: "Synthetic title",
    text: "Synthetic first paragraph.\n\nSynthetic second paragraph.",
  })

  const loaded = await privateReadingProvider.load(course)
  assert.equal(loaded.ok, true)
  assert.deepEqual(loaded.pages, [{ id: "101", title: "Synthetic title" }])
  assert.deepEqual(reading(loaded.bundle, "101")?.paragraphs.map((paragraph) => paragraph.text), [
    "Synthetic first paragraph.",
    "Synthetic second paragraph.",
  ])
})

test("private records are stored in restricted JSON files", async () => {
  const root = await useScratch()
  await savePrivateReading("agentic-architect", "12", { pageId: "101", title: "Synthetic title", text: "Synthetic fixture text." })
  const directory = path.join(root, "agentic-architect", "12")
  const names = await readdir(directory)
  assert.equal(names.length, 1)
  assert.match(names[0] ?? "", /^[a-f0-9]{64}\.json$/)
  const name = names[0]
  assert.ok(name)
  const file = path.join(directory, name)
  assert.equal((await stat(file)).mode & 0o777, 0o600)
  assert.equal((await stat(root)).mode & 0o777, 0o700)
  assert.equal((await stat(path.dirname(directory))).mode & 0o777, 0o700)
  assert.match(await readFile(file, "utf8"), /Synthetic fixture text\./)
})

test("the store refuses another checkout, including the shared main checkout", async () => {
  await useScratch()
  const checkout = path.join(scratch, "synthetic-checkout")
  await mkdir(path.join(checkout, ".git"), { recursive: true })
  process.env.QUIZ_PRIVATE_DIR = path.join(checkout, "store")
  await assert.rejects(readPrivateReadings("agentic-architect", "12"), /outside the repository/)
})

test("privacy guards include records whose pack is no longer installed", async () => {
  await useScratch()
  await savePrivateReading("removed-pack", "99", { pageId: "101", title: "Synthetic title", text: "Synthetic orphan fixture." })
  assert.equal((await allPrivateReadings())[0]?.text, "Synthetic orphan fixture.")
})

test("a linked course is refused before any directory is created or permissions are changed", async () => {
  const root = await useScratch()
  const elsewhere = path.join(scratch, "elsewhere")
  await mkdir(elsewhere, { mode: 0o755 })
  await mkdir(root, { recursive: true })
  await symlink(elsewhere, path.join(root, "agentic-architect"))
  await assert.rejects(savePrivateReading("agentic-architect", "12", { pageId: "101", title: "Synthetic", text: "Synthetic." }), /points outside/)
  assert.equal((await stat(elsewhere)).mode & 0o777, 0o755)
  assert.deepEqual(await readdir(elsewhere), [])
})

test("linked records fail explicitly instead of hiding a saved page", async () => {
  const root = await useScratch()
  await savePrivateReading("agentic-architect", "12", { pageId: "101", title: "Synthetic", text: "Synthetic." })
  const target = path.join(scratch, "synthetic.json")
  await writeFile(target, "{}")
  await symlink(target, path.join(root, "agentic-architect", "12", "linked.json"))
  await assert.rejects(readPrivateReadings("agentic-architect", "12"), /linked records/)
})

test("private store paths and captured values are validated", async () => {
  await useScratch()
  await assert.rejects(savePrivateReading("../other-pack", "12", { pageId: "101", title: "Synthetic", text: "Synthetic." }), /pack id is invalid/)
  await assert.rejects(savePrivateReading("agentic-architect", "../12", { pageId: "101", title: "Synthetic", text: "Synthetic." }), /course id is invalid/)
  await assert.rejects(savePrivateReading("agentic-architect", "12", { pageId: "../101", title: "Synthetic", text: "Synthetic." }), /page id is invalid/)
  await assert.rejects(savePrivateReading("agentic-architect", "12", { pageId: "101", title: "", text: "Synthetic." }), /needs a title and text/)
})

test("a private directory inside the repository is refused, including through a symlink", async () => {
  await useScratch()
  process.env.QUIZ_PRIVATE_DIR = path.join(testRoot, "private-readings-test")
  await assert.rejects(readPrivateReadings("agentic-architect", "12"), /outside the repository/)

  const link = path.join(scratch, "repo-link")
  await symlink(testRoot, link)
  process.env.QUIZ_PRIVATE_DIR = path.join(link, "private-readings-test")
  await assert.rejects(readPrivateReadings("agentic-architect", "12"), /outside the repository/)
})

test("private text reaches Read Aloud as captured, and instructional phrases are not filtered out", async () => {
  await useScratch()
  const lines = ["Click Next to continue.", "Skip to main content", "Mark as complete", "Copyright Synthetic Example", "Review the diagram, then answer below."]
  await savePrivateReading("agentic-architect", "12", { pageId: "201", title: "Synthetic phrases", text: lines.join("\n") })
  const course = loadPack(testRoot, "agentic-architect").courses.find((entry) => entry.provider === "private")
  assert.ok(course)
  const loaded = await privateReadingProvider.load(course)
  assert.equal(loaded.ok, true)
  if (!loaded.ok) return
  const found = reading(loaded.bundle, "201")
  assert.deepEqual(found?.paragraphs.filter((paragraph) => !paragraph.heading).map((paragraph) => paragraph.text), lines)
})

test("a new capture changes the Night script, so the old recording is replaced, not kept", async () => {
  const root = await useScratch()
  const course = loadPack(testRoot, "agentic-architect").courses.find((entry) => entry.provider === "private")
  assert.ok(course)
  async function parts() {
    const loaded = await privateReadingProvider.load(course!)
    assert.equal(loaded.ok, true)
    if (!loaded.ok) throw new Error("not loaded")
    return nightParts([{
      id: course!.id,
      title: course!.title,
      readings: loaded.pages.map((page, index) => ({
        number: index + 1,
        title: page.title,
        paragraphs: (reading(loaded.bundle, page.id)?.paragraphs ?? []).map((paragraph) => ({ text: paragraph.text, heading: paragraph.heading })),
      })),
    }])
  }
  const dir = path.join(root, "night-scratch")
  const render = async (_script: string, file: string) => {
    await writeFile(file, wavFromPcm(new Uint8Array(4)))
    return true
  }
  const encode = async (_wav: string, m4a: string) => {
    await writeFile(m4a, "audio")
  }
  await savePrivateReading("agentic-architect", "12", { pageId: "301", title: "Synthetic first", text: "First synthetic sentence." })
  const first = await buildRecording({ dir, parts: await parts(), render, encode })
  await savePrivateReading("agentic-architect", "12", { pageId: "302", title: "Synthetic second", text: "Second synthetic sentence." })
  const second = await buildRecording({ dir, parts: await parts(), render, encode })
  assert.notEqual(second.key, first.key)
  assert.deepEqual((await readdir(dir)).filter((name) => /^[0-9a-f]{64}$/.test(name)), [second.key])
})

test("a page id is 1 to 20 digits, the same range progress accepts", () => {
  const input = (pageId: string) => ({ pageId, title: "Synthetic", text: "Synthetic text." })
  assert.equal(isPrivateReadingInput(input("1")), true)
  assert.equal(isPrivateReadingInput(input("18446744073709551615")), true, "the largest 64-bit hash")
  assert.equal(isPrivateReadingInput(input("184467440737095516150")), false, "21 digits")
  assert.equal(isPrivateReadingInput(input("")), false)
  assert.equal(isPrivateReadingInput(input("1".repeat(10_000))), false, "a huge id is refused before anything is written")
})

test("a course holds a fixed number of readings, refuses one more, and still replaces an existing page", async () => {
  await useScratch()
  for (let id = 1; id <= MAX_RECORDS_PER_COURSE; id += 1) {
    await savePrivateReading("agentic-architect", "12", { pageId: String(id), title: "Synthetic", text: "Synthetic text." })
  }
  await assert.rejects(() => savePrivateReading("agentic-architect", "12", { pageId: String(MAX_RECORDS_PER_COURSE + 1), title: "Synthetic", text: "Synthetic text." }), PrivateStoreLimitError)
  const replaced = await savePrivateReading("agentic-architect", "12", { pageId: "1", title: "Synthetic", text: "Replaced synthetic text." })
  assert.equal(replaced.text, "Replaced synthetic text.")
  assert.equal((await readPrivateReadings("agentic-architect", "12")).length, MAX_RECORDS_PER_COURSE)
  // Another course has its own room.
  await savePrivateReading("agentic-architect", "13", { pageId: "1", title: "Synthetic", text: "Synthetic text." })
})

test("replacing a page keeps the day it was first saved", async () => {
  const root = await useScratch()
  const first = await savePrivateReading("agentic-architect", "12", { pageId: "7", title: "Synthetic", text: "First synthetic text." })
  const file = (await readdir(path.join(root, "agentic-architect", "12")))[0]!
  const stored = JSON.parse(await readFile(path.join(root, "agentic-architect", "12", file), "utf8"))
  await writeFile(path.join(root, "agentic-architect", "12", file), JSON.stringify({ ...stored, savedAt: "2026-01-01T00:00:00.000Z" }))
  const second = await savePrivateReading("agentic-architect", "12", { pageId: "7", title: "Synthetic", text: "Second synthetic text." })
  assert.equal(second.savedAt, "2026-01-01T00:00:00.000Z")
  assert.notEqual(first.savedAt, second.savedAt)
})

test("one damaged record makes its course unreadable with a message, and never throws or shows its text", async () => {
  const root = await useScratch()
  await savePrivateReading("agentic-architect", "12", { pageId: "21", title: "Synthetic good", text: "Good synthetic text." })
  await writeFile(path.join(root, "agentic-architect", "12", "damaged.json"), "{ not json Synthetic secret text")
  const course = loadPack(testRoot, "agentic-architect").courses.find((entry) => entry.provider === "private")
  assert.ok(course)
  const loaded = await privateReadingProvider.load(course)
  assert.equal(loaded.ok, false)
  if (!loaded.ok) assert.equal(loaded.error.includes("Synthetic secret text"), false)
})

test("a changed record is read again, an unchanged one comes from memory", async () => {
  const root = await useScratch()
  await savePrivateReading("agentic-architect", "12", { pageId: "31", title: "Synthetic", text: "Original synthetic text." })
  assert.equal((await readPrivateReadings("agentic-architect", "12"))[0]?.text, "Original synthetic text.")
  await savePrivateReading("agentic-architect", "12", { pageId: "31", title: "Synthetic", text: "Changed synthetic text, longer." })
  assert.equal((await readPrivateReadings("agentic-architect", "12"))[0]?.text, "Changed synthetic text, longer.")
  assert.ok(root)
})
