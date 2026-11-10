import assert from "node:assert/strict"
import { mkdir, mkdtemp, readFile, readdir, rm, stat, symlink, truncate, utimes, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import test, { afterEach } from "node:test"
import { MAX_COURSE_BYTES, MAX_RECORDS_PER_COURSE, PrivateRecordError, PrivateStoreLimitError, allPrivateReadings, cachedCourseCount, privateReadingProblem, isPrivateReadingInput, privateReadingRoot, readPrivateReadings, savePrivateReading } from "./private-reading.ts"
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

test("an unchanged course comes from memory, and a rewrite of the same size is still noticed by its modified time", async () => {
  const root = await useScratch()
  await savePrivateReading("agentic-architect", "12", { pageId: "31", title: "Synthetic", text: "Original synthetic text." })
  const first = await readPrivateReadings("agentic-architect", "12")
  assert.equal(await readPrivateReadings("agentic-architect", "12"), first, "the second read returns the very same parsed records, read from nothing")
  // A same-length change, with the file's modified time moved on, so only the time can tell it apart.
  const folder = path.join(root, "agentic-architect", "12")
  const file = path.join(folder, (await readdir(folder))[0]!)
  const stored = await readFile(file, "utf8")
  await writeFile(file, stored.replace("Original", "Changed!"))
  const later = new Date(Date.now() + 60_000)
  await utimes(file, later, later)
  const second = await readPrivateReadings("agentic-architect", "12")
  assert.notEqual(second, first)
  assert.equal(second[0]?.text, "Changed! synthetic text.")
})

test("a changed record is read again", async () => {
  await useScratch()
  await savePrivateReading("agentic-architect", "12", { pageId: "32", title: "Synthetic", text: "Original synthetic text." })
  assert.equal((await readPrivateReadings("agentic-architect", "12"))[0]?.text, "Original synthetic text.")
  await savePrivateReading("agentic-architect", "12", { pageId: "32", title: "Synthetic", text: "Changed synthetic text, longer." })
  assert.equal((await readPrivateReadings("agentic-architect", "12"))[0]?.text, "Changed synthetic text, longer.")
})

test("deleting a course folder drops its text from memory too", async () => {
  const root = await useScratch()
  // Other tests leave their own courses in memory, so the count is compared with what it was before this course was read.
  const baseline = cachedCourseCount()
  await savePrivateReading("agentic-architect", "12", { pageId: "41", title: "Synthetic", text: "Text that must not outlive its folder." })
  assert.equal((await readPrivateReadings("agentic-architect", "12")).length, 1)
  await rm(path.join(root, "agentic-architect", "12"), { recursive: true })
  assert.equal(cachedCourseCount(), baseline + 1, "the course's text is still held in memory until the next read notices the folder is gone")
  assert.deepEqual(await readPrivateReadings("agentic-architect", "12"), [])
  assert.equal(cachedCourseCount(), baseline, "and dropped from memory once the folder is gone")
  // A new course folder is read fresh, not merged with what was there before.
  await savePrivateReading("agentic-architect", "12", { pageId: "42", title: "Synthetic", text: "Fresh synthetic text." })
  assert.deepEqual((await readPrivateReadings("agentic-architect", "12")).map((record) => record.pageId), ["42"])
})

test("a damaged record that is plain text makes the course unreadable and its error never quotes the file", async () => {
  const root = await useScratch()
  await savePrivateReading("agentic-architect", "12", { pageId: "51", title: "Synthetic good", text: "Good synthetic text." })
  // Starts with a letter, the shape whose JSON parser message quotes the start of the input.
  await writeFile(path.join(root, "agentic-architect", "12", "damaged.json"), "Synthetic secret plain text that is not JSON at all")
  const course = loadPack(testRoot, "agentic-architect").courses.find((entry) => entry.provider === "private")
  assert.ok(course)
  const loaded = await privateReadingProvider.load(course)
  assert.equal(loaded.ok, false)
  if (!loaded.ok) {
    assert.equal(loaded.error.includes("Synthetic secret"), false)
    assert.match(loaded.error, /damaged\.json is not valid JSON/)
    assert.equal(loaded.problem, "record", "a damaged file is a record problem, so the page says to remove it")
  }
})

test("text and title limits are exact: the largest is accepted and one more is refused", () => {
  const input = (text: string, title = "Synthetic") => ({ pageId: "1", title, text })
  assert.equal(isPrivateReadingInput(input("a".repeat(1_000_000))), true)
  assert.equal(isPrivateReadingInput(input("a".repeat(1_000_001))), false)
  assert.equal(isPrivateReadingInput(input("Synthetic", "t".repeat(500))), true)
  assert.equal(isPrivateReadingInput(input("Synthetic", "t".repeat(501))), false)
  // Control characters take six bytes each in JSON, so this fits the character limit but not the record size limit.
  assert.equal(isPrivateReadingInput(input("\u0001".repeat(1_000_000))), false)
})

test("a course at its byte limit refuses a new page but still replaces an existing one", async () => {
  const root = await useScratch()
  await savePrivateReading("agentic-architect", "12", { pageId: "61", title: "Synthetic", text: "Synthetic text." })
  const folder = path.join(root, "agentic-architect", "12")
  const file = path.join(folder, (await readdir(folder))[0]!)
  // A sparse file takes no real disk but counts at its full size, which is what the limit adds up.
  await truncate(file, MAX_COURSE_BYTES)
  await assert.rejects(() => savePrivateReading("agentic-architect", "12", { pageId: "62", title: "Synthetic", text: "Synthetic text." }), PrivateStoreLimitError)
  const replaced = await savePrivateReading("agentic-architect", "12", { pageId: "61", title: "Synthetic", text: "Replacement text." })
  assert.equal(replaced.text, "Replacement text.")
})

test("the course byte limit counts a new reading as it will be written, escapes included", async () => {
  const root = await useScratch()
  await savePrivateReading("agentic-architect", "12", { pageId: "71", title: "Synthetic", text: "Synthetic text." })
  const folder = path.join(root, "agentic-architect", "12")
  const file = path.join(folder, (await readdir(folder))[0]!)
  // One million bytes of room are left. 400,000 control characters are 400,000 bytes raw but about 2.4 MB as JSON.
  await truncate(file, MAX_COURSE_BYTES - 1_000_000)
  const text = "\u0001".repeat(400_000)
  assert.equal(new TextEncoder().encode(text).byteLength < 1_000_000, true, "the raw text would fit")
  await assert.rejects(() => savePrivateReading("agentic-architect", "12", { pageId: "72", title: "Synthetic", text }), PrivateStoreLimitError)
  const small = await savePrivateReading("agentic-architect", "12", { pageId: "73", title: "Synthetic", text: "Synthetic text." })
  assert.equal(small.pageId, "73", "a reading that does fit is still saved")
})

test("the text limit counts UTF-16 units, so an emoji counts as two", () => {
  const input = (text: string) => ({ pageId: "1", title: "Synthetic", text })
  assert.equal(isPrivateReadingInput(input("\u{1F600}".repeat(500_000))), true, "1,000,000 units")
  assert.equal(isPrivateReadingInput(input("\u{1F600}".repeat(500_001))), false, "1,000,002 units")
})

test("each refusal has its own problem: id, reading or size", () => {
  const input = (pageId: string, text: string) => ({ pageId, title: "Synthetic", text })
  assert.equal(privateReadingProblem(input("1", "Synthetic text.")), null)
  assert.equal(privateReadingProblem(input("1".repeat(21), "Synthetic text.")), "id")
  assert.equal(privateReadingProblem(input("abc", "Synthetic text.")), "id")
  assert.equal(privateReadingProblem(input("1", "  ")), "reading")
  assert.equal(privateReadingProblem({ pageId: "1", title: "t".repeat(501), text: "Synthetic text." }), "title", "a title over 500 characters")
  assert.equal(privateReadingProblem({ pageId: "1", title: "  ", text: "Synthetic text." }), "title", "an empty title")
  assert.equal(privateReadingProblem(input("1", "a".repeat(1_000_001))), "reading")
  assert.equal(privateReadingProblem(input("1", "\u0001".repeat(1_000_000))), "size", "within the character limit but too large once written")
  assert.equal(privateReadingProblem(null), "reading")
})

test("a record larger than the store reads back is refused on reading, with a record problem and without its text", async () => {
  const root = await useScratch()
  await savePrivateReading("agentic-architect", "12", { pageId: "81", title: "Synthetic", text: "Synthetic text." })
  const folder = path.join(root, "agentic-architect", "12")
  const file = path.join(folder, (await readdir(folder))[0]!)
  await truncate(file, 4_000_001)
  await assert.rejects(() => readPrivateReadings("agentic-architect", "12"), (error: unknown) => {
    assert.ok(error instanceof PrivateRecordError, "it is a record problem")
    assert.match((error as Error).message, /^Private reading record .+\.json is too large\.$/)
    return true
  })
})

test("each kind of failure the page shows is typed by the store itself, not guessed from its wording", async () => {
  const root = await useScratch()
  const course = loadPack(testRoot, "agentic-architect").courses.find((entry) => entry.provider === "private")
  assert.ok(course)
  const problemOf = async () => {
    const loaded = await privateReadingProvider.load(course)
    assert.equal(loaded.ok, false)
    return loaded.ok ? undefined : loaded.problem
  }
  await savePrivateReading("agentic-architect", "12", { pageId: "91", title: "Synthetic", text: "Synthetic text." })
  const folder = path.join(root, "agentic-architect", "12")
  // A link inside the course folder: the way on is to remove the link, which is a record problem.
  await symlink(path.join(root, "elsewhere.json"), path.join(folder, "link.json"))
  assert.equal(await problemOf(), "record", "a linked record")
  await rm(path.join(folder, "link.json"))
  // A damaged and a too large file.
  await writeFile(path.join(folder, "damaged.json"), "plain text that is not JSON")
  assert.equal(await problemOf(), "record", "a damaged file")
  await rm(path.join(folder, "damaged.json"))
  // A setting that is not allowed is the folder's problem, and removing a reading would not help.
  const before = process.env.QUIZ_PRIVATE_DIR
  process.env.QUIZ_PRIVATE_DIR = "relative/path"
  try {
    assert.equal(await problemOf(), "folder", "a setting that is not an absolute path")
  } finally {
    process.env.QUIZ_PRIVATE_DIR = before
  }
})
