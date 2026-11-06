import assert from "node:assert/strict"
import { mkdtemp, readFile, readdir, rm, stat, symlink } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import test, { afterEach } from "node:test"
import { privateReadingRoot, readPrivateReadings, savePrivateReading } from "./private-reading.ts"
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
  assert.match(await readFile(file, "utf8"), /Synthetic fixture text\./)
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
