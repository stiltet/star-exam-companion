import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { createServer } from "node:net"
import { tmpdir } from "node:os"
import path from "node:path"
import test from "node:test"
import { startFakeSite, type FakeCard, type FakeSite } from "./fake-lesson-site.ts"
import { readPrivateReadings } from "./private-reading.ts"
import { testRoot } from "./test-pack.ts"

// These tests run the real command, `node scripts/reading-crawl.mts`, against a fake lesson site that serves made-up lessons, with a
// scratch exam, a scratch private store and a scratch browser profile. No real Google page and no real lesson text is involved.

const quiz = path.join(testRoot, "quiz")

async function freePort(): Promise<number> {
  const probe = createServer()
  await new Promise<void>((resolve) => probe.listen(0, "127.0.0.1", resolve))
  const port = (probe.address() as { port: number }).port
  await new Promise<void>((resolve) => probe.close(() => resolve()))
  return port
}

// A scratch copy of the exams with one more: "crawl-test", whose two courses (templates 9001 and 9002) are private.
async function scratch(): Promise<string> {
  const base = await mkdtemp(path.join(tmpdir(), "crawl-run-"))
  const exams = path.join(base, "root", "exams")
  await mkdir(exams, { recursive: true })
  await cp(path.join(testRoot, "exams", "generative-ai-leader"), path.join(exams, "generative-ai-leader"), { recursive: true })
  const pack = path.join(exams, "crawl-test")
  await cp(path.join(testRoot, "exams", "agentic-architect"), pack, { recursive: true })
  const meta = JSON.parse(await readFile(path.join(pack, "pack.json"), "utf8"))
  await writeFile(path.join(pack, "pack.json"), JSON.stringify({ ...meta, id: "crawl-test", title: "Crawl Test Exam" }))
  const courses = JSON.parse(await readFile(path.join(pack, "courses.json"), "utf8"))
  await writeFile(path.join(pack, "courses.json"), JSON.stringify({
    path: courses.path,
    bundleBase: courses.bundleBase,
    courses: [
      { id: "1", template: "9001", title: "First Course", provider: "private" },
      { id: "2", template: "9002", title: "Second Course", provider: "private" },
    ],
  }))
  return base
}

type Run = { code: number | null; out: string; port: number }

// extra replaces or adds environment settings; a value of undefined removes one.
async function runCrawl(base: string, site: FakeSite, extra: Record<string, string | undefined> = {}): Promise<Run> {
  const port = await freePort()
  const env: Record<string, string | undefined> = {
    ...process.env,
    NO_COLOR: "1",
    QUIZ_ROOT: path.join(base, "root"),
    QUIZ_PRIVATE_DIR: path.join(base, "private"),
    READING_SITE: site.url,
    READING_CDP_URL: `http://127.0.0.1:${port}`,
    READING_PROFILE_DIR: path.join(base, "profile"),
    READING_FRAME_HOSTS: "127.0.0.1",
    READING_SKIP_SIGNIN: "1",
    READING_PAUSE_MS: "0",
    READING_RETRY_BASE_MS: "50",
    READING_SETTLE_MS: "1500",
    READING_MIN_WATCH_MS: "2000",
    READING_EMPTY_AFTER_MS: "2500",
  }
  for (const [key, value] of Object.entries(extra)) {
    if (value === undefined) delete env[key]
    else env[key] = value
  }
  const child = spawn(process.execPath, ["scripts/reading-crawl.mts", "crawl-test"], { cwd: quiz, env })
  let out = ""
  child.stdout.on("data", (chunk) => { out += String(chunk) })
  child.stderr.on("data", (chunk) => { out += String(chunk) })
  const code = await new Promise<number | null>((resolve) => child.on("close", resolve))
  return { code, out, port }
}

// The store is read in this process, so it points at the scratch folder while a test looks at it.
async function saved(base: string, course: string) {
  const before = process.env.QUIZ_PRIVATE_DIR
  process.env.QUIZ_PRIVATE_DIR = path.join(base, "private")
  try {
    return await readPrivateReadings("crawl-test", course)
  } finally {
    if (before === undefined) delete process.env.QUIZ_PRIVATE_DIR
    else process.env.QUIZ_PRIVATE_DIR = before
  }
}

function noLessonText(run: Run, texts: string[]): void {
  for (const text of texts) assert.equal(run.out.includes(text), false, "the output never holds lesson text")
}

// The browser the crawl started must be gone once the command ends. It may take a moment to finish closing, so look for a few seconds.
async function browserClosed(port: number): Promise<boolean> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    try {
      await fetch(`http://127.0.0.1:${port}/json/version`, { signal: AbortSignal.timeout(1_000) })
    } catch {
      return true
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  return false
}

const INTRO = "Synthetic intro lesson text that is long enough to be a reading."
const REPEAT_ONE = "Synthetic first repeated-title lesson text, long enough to count."
const REPEAT_TWO = "Synthetic second repeated-title lesson text, long enough to count."
const SETTLED = "Synthetic settled lesson text that appears after the page has loaded."
const DOCUMENT = "Synthetic document lesson text that is long enough to be a reading."
const PDF = "Synthetic pdf lesson text that is long enough to be read from a PDF"

test("the crawl saves every lesson, reports plainly, and a second run finds nothing to change", { timeout: 240_000 }, async (t) => {
  const base = await scratch()
  const courses: Record<string, FakeCard[]> = {
    "9001": [
      { title: "Intro bundle", kind: "bundle", text: INTRO },
      { title: "Knowledge check", kind: "bundle", text: REPEAT_ONE },
      { title: "Quiz time", quiz: true },
      { title: "Settling lesson", kind: "settle", text: SETTLED },
      { title: "Knowledge check", kind: "bundle", text: REPEAT_TWO },
    ],
    "9002": [
      { title: "Document lesson", kind: "document", text: DOCUMENT },
      { title: "PDF lesson", kind: "pdf", text: PDF },
    ],
  }
  const site = await startFakeSite(courses)
  t.after(async () => {
    await site.close()
    await rm(base, { recursive: true, force: true })
  })
  const texts = [INTRO, REPEAT_ONE, REPEAT_TWO, SETTLED, DOCUMENT, PDF]

  await t.test("the first run captures all six lessons, says FINISHED and holds no lesson text", async () => {
    const run = await runCrawl(base, site)
    assert.equal(run.code, 0, run.out)
    assert.match(run.out, /Exams on this server/)
    assert.match(run.out, /Crawl Test Exam: 2 courses to capture from Google Skills/)
    assert.match(run.out, /Generative AI Leader: nothing to capture/)
    assert.match(run.out, /Crawling Crawl Test Exam/)
    assert.match(run.out, /Signed in as synthetic\.user@example\.test/, "the log says which user is signed in")
    assert.match(run.out, /Reading a lesson marks it as completed on this Google account\. Use a secondary account/, "the log warns about progress")
    assert.match(run.out, /✔ FINISHED: all 6 lessons checked in 2 courses/)
    assert.match(run.out, /✔ 1\. First Course\n {6}4 lessons: 4 new, 0 updated, 0 unchanged/)
    assert.match(run.out, /✔ 2\. Second Course\n {6}2 lessons: 2 new, 0 updated, 0 unchanged/)
    noLessonText(run, texts)
    assert.equal(await browserClosed(run.port), true, "the browser the crawl started is closed at the end")
  })

  await t.test("every lesson is saved with its own text: repeated titles, the settled text, the document and the PDF", async () => {
    const first = await saved(base, "1")
    assert.equal(first.length, 4, "the quiz card is not a lesson")
    const byText = new Map(first.map((record) => [record.text, record.title]))
    assert.equal(byText.get(INTRO), "Intro bundle")
    assert.equal(byText.get(REPEAT_ONE), "Knowledge check")
    assert.equal(byText.get(REPEAT_TWO), "Knowledge check")
    assert.equal(byText.get(SETTLED), "Settling lesson", "the text is read once it has settled, not the placeholder")
    const second = await saved(base, "2")
    assert.equal(second.length, 2)
    const bySecond = new Map(second.map((record) => [record.title, record.text]))
    assert.equal(bySecond.get("Document lesson"), DOCUMENT)
    assert.equal(bySecond.get("PDF lesson"), PDF, "a PDF lesson's text is read from the PDF")
  })

  await t.test("the manifest keeps the lessons in order with their addresses, and no text", async () => {
    const raw = await readFile(path.join(base, "private", "crawl-test", "1.manifest.json"), "utf8")
    const manifest = JSON.parse(raw) as { lessons: { title: string; href: string; hash: string | null }[] }
    assert.deepEqual(manifest.lessons.map((lesson) => lesson.title), ["Intro bundle", "Knowledge check", "Settling lesson", "Knowledge check"])
    assert.ok(manifest.lessons.every((lesson) => /^\/course_templates\/9001\/html_bundles\/\d+$/.test(lesson.href) && lesson.hash && lesson.hash.length === 64))
    for (const text of texts) assert.equal(raw.includes(text), false)
  })

  await t.test("a second run with nothing new changes nothing", async () => {
    const run = await runCrawl(base, site)
    assert.equal(run.code, 0, run.out)
    assert.match(run.out, /✔ FINISHED/)
    assert.match(run.out, /4 lessons: 0 new, 0 updated, 4 unchanged/)
    assert.match(run.out, /2 lessons: 0 new, 0 updated, 2 unchanged/)
  })

  await t.test("a lesson that Google changed is read again and saved over the old copy", async () => {
    const changed = "Synthetic changed intro text that is long enough to be a reading."
    site.setText("Intro bundle", changed)
    const run = await runCrawl(base, site)
    assert.equal(run.code, 0, run.out)
    assert.match(run.out, /4 lessons: 0 new, 1 updated, 3 unchanged/)
    noLessonText(run, [changed])
    const first = await saved(base, "1")
    assert.equal(first.length, 4, "the lesson is replaced, not added again")
    assert.equal(first.find((record) => record.title === "Intro bundle")?.text, changed)
  })
})

test("a lesson with no text and a request that fails once are both reported, and the verdict is NOT FINISHED", { timeout: 240_000 }, async (t) => {
  const base = await scratch()
  const retryText = "Synthetic text of the lesson whose first request is cut off."
  const fineText = "Synthetic text of a lesson that simply works, long enough to count."
  const site = await startFakeSite({
    "9001": [
      { title: "Dropped once", kind: "drop-first", text: retryText },
      { title: "Empty lesson", kind: "notext", text: "Short" },
    ],
    "9002": [{ title: "Fine lesson", kind: "bundle", text: fineText }],
  })
  t.after(async () => {
    await site.close()
    await rm(base, { recursive: true, force: true })
  })
  const run = await runCrawl(base, site)
  assert.equal(run.code, 1, run.out)
  assert.match(run.out, /retry 2 of 5: Dropped once/)
  assert.match(run.out, /✖ NOT FINISHED: 1 of 2 courses incomplete/)
  assert.match(run.out, /✖ 1\. First Course\n {6}2 lessons: 1 new, 0 updated, 0 unchanged\n {6}✖ no reading text: Empty lesson/)
  assert.match(run.out, /✔ 2\. Second Course/)
  noLessonText(run, [retryText, fineText])
  assert.deepEqual((await saved(base, "1")).map((record) => record.title), ["Dropped once"], "the dropped request was tried again and saved")
  assert.equal((await saved(base, "2")).length, 1)
  assert.equal(await browserClosed(run.port), true)
})

test("a signed-out visitor stops the crawl with a clear message and nothing is saved", { timeout: 240_000 }, async (t) => {
  const base = await scratch()
  const site = await startFakeSite({
    "9001": [{ title: "Only lesson", kind: "bundle", text: "Synthetic lesson text that would be saved if the visitor were signed in." }],
    "9002": [{ title: "Other lesson", kind: "bundle", text: "Synthetic other lesson text that would be saved if signed in, too." }],
  })
  site.signedOut = true
  t.after(async () => {
    await site.close()
    await rm(base, { recursive: true, force: true })
  })
  const run = await runCrawl(base, site)
  assert.equal(run.code, 1, run.out)
  assert.match(run.out, /Could not tell who is signed in/)
  assert.match(run.out, /■ STOPPED at page 0 of 2: Chrome for Testing is not signed in to Google Skills/)
  assert.doesNotMatch(run.out, /FINISHED/)
  assert.equal((await saved(base, "1")).length, 0)
  assert.equal(await browserClosed(run.port), true)
})

test("a site that lists no lessons stops the crawl and says so, instead of ending silently", { timeout: 240_000 }, async (t) => {
  const base = await scratch()
  const site = await startFakeSite({ "9001": [{ title: "Only a quiz", quiz: true }], "9002": [{ title: "Only a quiz", quiz: true }] })
  t.after(async () => {
    await site.close()
    await rm(base, { recursive: true, force: true })
  })
  const run = await runCrawl(base, site)
  assert.equal(run.code, 1, run.out)
  assert.match(run.out, /✖ 1\. First Course: the site lists no lessons for it\./)
  assert.match(run.out, /■ STOPPED at page 0 of 0: the site lists no lessons/)
  assert.equal(await browserClosed(run.port), true)
})

test("when the browser's account prompt does not appear, the crawl presses Sign in and Sign in with Google itself", { timeout: 240_000 }, async (t) => {
  const base = await scratch()
  const text = "Synthetic lesson text that is read only after the sign-in buttons were pressed."
  const site = await startFakeSite({
    "9001": [{ title: "Only lesson", kind: "bundle", text }],
    "9002": [{ title: "Other lesson", kind: "bundle", text: "Synthetic other lesson text that is read after the sign-in buttons, too." }],
  })
  site.signedOut = true
  t.after(async () => {
    await site.close()
    await rm(base, { recursive: true, force: true })
  })
  const run = await runCrawl(base, site, { READING_SKIP_SIGNIN: undefined, READING_PROMPT_WAIT_MS: "500" })
  assert.equal(run.code, 0, run.out)
  assert.match(run.out, /Signing in to Google Skills/)
  assert.match(run.out, /Signed in as synthetic\.user@example\.test/)
  assert.match(run.out, /✔ FINISHED: all 2 lessons checked in 2 courses/)
  assert.equal(site.signedOut, false, "the Sign in with Google button was pressed")
  assert.equal((await saved(base, "1")).length, 1)
  noLessonText(run, [text])
  assert.equal(await browserClosed(run.port), true)
})

test("a course that holds only labs, videos and quizzes is named as having nothing to read, and the crawl still finishes", { timeout: 240_000 }, async (t) => {
  const base = await scratch()
  const text = "Synthetic lesson text of the one course that has something to read, long enough."
  const site = await startFakeSite({
    "9001": [{ title: "A lab", other: "lab" }, { title: "A video", other: "video" }, { title: "A quiz", quiz: true }],
    "9002": [{ title: "Only reading lesson", kind: "bundle", text }],
  })
  t.after(async () => {
    await site.close()
    await rm(base, { recursive: true, force: true })
  })
  const run = await runCrawl(base, site)
  assert.equal(run.code, 0, run.out)
  assert.match(run.out, /✔ FINISHED: all 1 lesson checked in 2 courses/)
  assert.match(run.out, /– 1\. First Course\n {6}no readable lessons: 1 lab, 1 video, 1 quiz/)
  assert.match(run.out, /✔ 2\. Second Course\n {6}1 lesson: 1 new, 0 updated, 0 unchanged/)
  assert.doesNotMatch(run.out, /✖/, "a course with nothing to read is not an error")
  assert.equal((await saved(base, "1")).length, 0)
  assert.equal((await saved(base, "2")).length, 1)
  noLessonText(run, [text])
})

