import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises"
import { createServer } from "node:net"
import { tmpdir } from "node:os"
import path from "node:path"
import { browserTest as test } from "./browser-test.ts"
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
async function runCrawl(base: string, site: FakeSite, extra: Record<string, string | undefined> = {}, flags: string[] = []): Promise<Run> {
  const port = await freePort()
  const env: NodeJS.ProcessEnv = {
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
    READING_SETTLE_MS: "600",
    // The lesson list is read again and again until the count holds; the command waits 1.5 s between reads. The tests that check that wait set their own.
    READING_LIST_SETTLE_MS: "200",
    // A page with no card is waited for 30 s, and a list still changing 30 s, by default; the fake site answers at once, so a short wait shows the same behaviour.
    READING_LIST_WAIT_MS: "1500",
    READING_LIST_MAX_MS: "5000",
    // The settling lesson of the fake site changes its text after 800 ms, so the shortest watch stays well past that.
    READING_MIN_WATCH_MS: "1500",
    READING_EMPTY_AFTER_MS: "2500",
  }
  // A shell that is set up for the real capture must not change a test: the account and the debug setting are the tests' own to give.
  delete env.READING_GOOGLE_ACCOUNT
  delete env.READING_DEBUG
  for (const [key, value] of Object.entries(extra)) {
    if (value === undefined) delete env[key]
    else env[key] = value
  }
  const child = spawn(process.execPath, ["scripts/reading-crawl.mts", "crawl-test", ...flags], { cwd: quiz, env })
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
    await rm(base, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 })
  })
  const texts = [INTRO, REPEAT_ONE, REPEAT_TWO, SETTLED, DOCUMENT, PDF]

  await t.test("the first run captures all six lessons, says FINISHED and holds no lesson text", async () => {
    const run = await runCrawl(base, site)
    assert.equal(run.code, 0, run.out)
    assert.match(run.out, /Exams on this server/)
    assert.match(run.out, /Crawl Test Exam: 2 courses to capture from Google Skills/)
    assert.match(run.out, /Generative AI Leader: skipped \(another exam was named\)/)
    assert.match(run.out, /Crawling Crawl Test Exam/)
    assert.match(run.out, /Signed in as synthetic\.user@example\.test/, "the log says which user is signed in")
    assert.match(run.out, /Reading a lesson marks it as completed on this Google account\. Use a secondary account/, "the log warns about progress")
    assert.match(run.out, /✔ FINISHED: all 6 lessons checked in 2 courses/)
    assert.match(run.out, /✔ 1\. First Course\n {6}4 lessons: 4 new, 0 updated, 0 unchanged/)
    assert.match(run.out, /✔ 2\. Second Course\n {6}2 lessons: 2 new, 0 updated, 0 unchanged/)
    noLessonText(run, texts)
    assert.equal(await browserClosed(run.port), true, "the browser the crawl started is closed at the end")
    const named = run.out.match(/Log: (\S+reading-crawl-\d{8}-\d{6}\.log)/)
    assert.ok(named, "the output names the log file")
    assert.equal(path.dirname(named[1]), path.join(base, "logs"), "the log sits beside the private store")
  })

  await t.test("the log holds the run's events, no lesson text and, without --debug, no detail lines", async () => {
    const files = (await readdir(path.join(base, "logs"))).filter((name) => name.startsWith("reading-crawl-"))
    assert.equal(files.length, 1)
    const log = await readFile(path.join(base, "logs", files[0] as string), "utf8")
    assert.match(log, /run\.start {2}target=crawl-test/)
    assert.match(log, /signin\.route {2}route=skipped/)
    assert.match(log, /run\.listed {2}courses=2 {2}lessons=6/)
    assert.equal(log.split("\n").filter((line) => line.includes(" lesson.done ")).length, 6)
    assert.match(log, /lesson\.done {2}course=1 {2}n=1 {2}of=6 {2}title="Intro bundle" {2}outcome=saved {2}chars=\d+/)
    assert.match(log, /run\.end {2}exit=0/)
    assert.equal(log.includes("lesson.goto"), false, "detail lines are kept only with --debug")
    for (const text of texts) assert.equal(log.includes(text), false, "the log never holds lesson text")
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

  await t.test("a run with --debug also logs the addresses visited and the reads, still with no lesson text and no ids", async () => {
    const run = await runCrawl(base, site, {}, ["--debug"])
    assert.equal(run.code, 0, run.out)
    const files = (await readdir(path.join(base, "logs"))).filter((name) => name.startsWith("reading-crawl-")).sort()
    const log = await readFile(path.join(base, "logs", files[files.length - 1] as string), "utf8")
    assert.match(log, /run\.start .*debug=true/)
    assert.match(log, /lesson\.goto {2}address=\S+\/course_templates\/N\/html_bundles\/N/)
    assert.match(log, /lesson\.settled /)
    assert.match(log, /lesson\.done .*outcome=same/)
    for (const text of texts) assert.equal(log.includes(text), false)
    assert.equal(/course_templates\/\d/.test(log), false, "addresses are written without their numbers")
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
    await rm(base, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 })
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
    await rm(base, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 })
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
    await rm(base, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 })
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
    await rm(base, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 })
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
    await rm(base, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 })
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


test("a video lesson is saved by its title in its place among the readings, and its page is never opened", { timeout: 240_000 }, async (t) => {
  const base = await scratch()
  const first = "Synthetic first reading text of a course with videos, long enough to count."
  const last = "Synthetic last reading text of a course with videos, long enough to count."
  const site = await startFakeSite({
    "9001": [{ title: "First reading", kind: "bundle", text: first }, { title: "A made-up video", video: true }, { title: "Last reading", kind: "bundle", text: last }],
    "9002": [{ title: "Only video", video: true }],
  })
  t.after(async () => {
    await site.close()
    await rm(base, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 })
  })
  const run = await runCrawl(base, site)
  assert.equal(run.code, 0, run.out)
  assert.match(run.out, /✔ FINISHED: all 4 lessons checked in 2 courses/)
  assert.match(run.out, /✔ 1\. First Course\n {6}3 lessons: 3 new, 0 updated, 0 unchanged/)
  assert.equal(site.videoPagesOpened, 0, "a video page is never opened, so it is not played or marked watched")
  const records = await saved(base, "1")
  assert.equal(records.length, 3)
  assert.equal(records.find((record) => record.title === "A made-up video")?.text, "A made-up video", "a video keeps its title and no text")
  const manifest = JSON.parse(await readFile(path.join(base, "private", "crawl-test", "1.manifest.json"), "utf8")) as { lessons: { title: string; kind?: string; href: string }[] }
  assert.deepEqual(manifest.lessons.map((lesson) => lesson.title), ["First reading", "A made-up video", "Last reading"], "the video keeps its place")
  assert.deepEqual(manifest.lessons.map((lesson) => lesson.kind), [undefined, "video", undefined])
  assert.match(manifest.lessons[1]!.href, /^\/course_templates\/9001\/video\/\d+$/)
  assert.equal((await saved(base, "2")).length, 1, "a course of only videos has its lessons too")
  noLessonText(run, [first, last])
})

test("when another Google account is signed in than the one asked for, the crawl stops before it opens a lesson", { timeout: 240_000 }, async (t) => {
  const base = await scratch()
  const text = "Synthetic lesson text that must never be read by the wrong account, long enough."
  const site = await startFakeSite({ "9001": [{ title: "Only lesson", kind: "bundle", text }], "9002": [{ title: "Other lesson", kind: "bundle", text }] })
  t.after(async () => {
    await site.close()
    await rm(base, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 })
  })
  const run = await runCrawl(base, site, { READING_GOOGLE_ACCOUNT: "someone.else@example.test" })
  assert.equal(run.code, 1, run.out)
  assert.match(run.out, /Signed in as synthetic\.user@example\.test/)
  assert.match(run.out, /✖ Could not confirm that the signed-in account is the one you asked for/)
  assert.match(run.out, /STOPPED/)
  assert.equal((await saved(base, "1")).length, 0, "no lesson was opened or saved")
  assert.equal((await saved(base, "2")).length, 0)
  noLessonText(run, [text])
  assert.equal(await browserClosed(run.port), true)
})

test("when the signed-in account is the one asked for, the crawl goes on, whatever the case of the address", { timeout: 240_000 }, async (t) => {
  const base = await scratch()
  const text = "Synthetic lesson text that the wanted account may read, long enough to count."
  const site = await startFakeSite({ "9001": [{ title: "Only lesson", kind: "bundle", text }], "9002": [{ title: "Other lesson", kind: "bundle", text }] })
  t.after(async () => {
    await site.close()
    await rm(base, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 })
  })
  const run = await runCrawl(base, site, { READING_GOOGLE_ACCOUNT: "Synthetic.User@Example.Test" })
  assert.equal(run.code, 0, run.out)
  assert.match(run.out, /✔ FINISHED: all 2 lessons checked in 2 courses/)
})

test("when the settings page shows more than one address, the crawl cannot tell which is the account's own and stops, if an account was asked for", { timeout: 240_000 }, async (t) => {
  const base = await scratch()
  const text = "Synthetic lesson text that must never be read when the account cannot be confirmed."
  const site = await startFakeSite({ "9001": [{ title: "Only lesson", kind: "bundle", text }], "9002": [{ title: "Other lesson", kind: "bundle", text }] })
  site.addresses = ["recovery.made.up@example.test", "synthetic.user@example.test"]
  t.after(async () => {
    await site.close()
    await rm(base, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 })
  })
  const run = await runCrawl(base, site, { READING_GOOGLE_ACCOUNT: "synthetic.user@example.test" })
  assert.equal(run.code, 1, run.out)
  assert.match(run.out, /Could not tell who is signed in/)
  assert.match(run.out, /✖ Could not confirm that the signed-in account is the one you asked for/)
  assert.equal((await saved(base, "1")).length, 0, "no lesson was opened")
  noLessonText(run, [text])
})

test("a course whose manifest was made under an older listing rule is not compared, the run logs that, and Google is not blamed", { timeout: 240_000 }, async (t) => {
  const base = await scratch()
  const text = "Synthetic lesson text of a course whose manifest is older than the listing rule, long enough."
  const site = await startFakeSite({ "9001": [{ title: "Only lesson", kind: "bundle", text }, { title: "A made-up video", video: true }], "9002": [{ title: "Other lesson", kind: "bundle", text }] })
  t.after(async () => {
    await site.close()
    await rm(base, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 })
  })
  // An earlier run's manifest, from before the listing version existed: it knows one lesson and no video.
  await mkdir(path.join(base, "private", "crawl-test"), { recursive: true })
  await writeFile(path.join(base, "private", "crawl-test", "1.manifest.json"), JSON.stringify({
    checkedAt: "2026-01-01T00:00:00.000Z",
    lessons: [{ title: "Only lesson", href: "/course_templates/9001/html_bundles/1000", pageId: "1000", hash: null }],
  }))
  const run = await runCrawl(base, site)
  assert.equal(run.code, 0, run.out)
  assert.doesNotMatch(run.out, /Google changed this course/, "the video the new rule lists is not blamed on Google")
  const files = (await readdir(path.join(base, "logs"))).filter((name) => name.startsWith("reading-crawl-"))
  const log = await readFile(path.join(base, "logs", files[0] as string), "utf8")
  assert.match(log, /compare\.skipped {2}course=1 {2}reason=listing/)
  assert.equal(log.includes("compare.skipped  course=2"), false, "a course with no manifest at all is simply a first run, not a skipped comparison")
})

test("a finished crawl removes the saved copy of a lesson Google no longer lists, names it, and leaves the other courses alone", { timeout: 240_000 }, async (t) => {
  const base = await scratch()
  const first = await startFakeSite({
    "9001": [{ title: "Stays lesson", kind: "bundle", text: "Synthetic text of a lesson that stays, long enough to count as a reading." }],
    "9002": [
      { title: "Also stays", kind: "bundle", text: "Synthetic text of the second lesson that stays, long enough to count as a reading." },
      { title: "Goes away", kind: "bundle", text: "Synthetic text of a lesson Google removes later, long enough to count as a reading." },
    ],
  })
  const second = await startFakeSite({
    "9001": [{ title: "Stays lesson", kind: "bundle", text: "Synthetic text of a lesson that stays, long enough to count as a reading." }],
    "9002": [{ title: "Also stays", kind: "bundle", text: "Synthetic text of the second lesson that stays, long enough to count as a reading." }],
  })
  t.after(async () => {
    await first.close()
    await second.close()
    await rm(base, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 })
  })
  const one = await runCrawl(base, first)
  assert.equal(one.code, 0, one.out)
  assert.doesNotMatch(one.out, /Removed \d+ saved lesson/)
  assert.equal((await saved(base, "2")).length, 2)
  const two = await runCrawl(base, second)
  assert.equal(two.code, 0, two.out)
  assert.match(two.out, /Removed 1 saved lesson\(s\) Google no longer lists:\n {2}crawl-test 2\. Goes away/)
  assert.deepEqual((await saved(base, "2")).map((record) => record.title), ["Also stays"])
  assert.equal((await saved(base, "1")).length, 1)
  noLessonText(two, ["Synthetic text of a lesson Google removes later, long enough to count as a reading."])
})

// The lists a second run is given: the course "2" has lost "Goes away" and, to be a real change, gained "Brand new lesson".
const KEEP = "Synthetic text of the second lesson that stays, long enough to count as a reading."
const GONE = "Synthetic text of a lesson Google removes later, long enough to count as a reading."
const NEW_LESSON = "Synthetic text of a lesson Google adds later, long enough to count as a reading."
const ONE = "Synthetic text of a lesson that stays, long enough to count as a reading."
const before = (): Record<string, FakeCard[]> => ({
  "9001": [{ title: "Stays lesson", kind: "bundle", text: ONE }],
  "9002": [{ title: "Also stays", kind: "bundle", text: KEEP }, { title: "Goes away", kind: "bundle", text: GONE }],
})
const after = (): Record<string, FakeCard[]> => ({
  "9001": [{ title: "Stays lesson", kind: "bundle", text: ONE }],
  "9002": [{ title: "Also stays", kind: "bundle", text: KEEP }, { title: "Brand new lesson", kind: "bundle", text: NEW_LESSON }],
})

test("a course page that fills in its cards late is read once the count settles, and what it lists is trusted", { timeout: 240_000 }, async (t) => {
  const base = await scratch()
  const first = await startFakeSite(before())
  const second = await startFakeSite(after(), {}, 2000)
  second.slowCards = { template: "9002", afterMs: 600 }
  t.after(async () => {
    await first.close()
    await second.close()
    await rm(base, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 })
  })
  assert.equal((await runCrawl(base, first)).code, 0)
  const run = await runCrawl(base, second, { READING_LIST_SETTLE_MS: "1000" })
  assert.equal(run.code, 0, run.out)
  assert.match(run.out, /✔ FINISHED: all 3 lessons/, "both cards of the slow course were read")
  assert.deepEqual((await saved(base, "2")).map((record) => record.title).sort(), ["Also stays", "Brand new lesson"])
  assert.match(run.out, /Removed 1 saved lesson\(s\) Google no longer lists:\n {2}crawl-test 2\. Goes away/)
})

test("a course page still changing after the longest wait is reported as unsettled, and nothing is pruned for it", { timeout: 240_000 }, async (t) => {
  const base = await scratch()
  const first = await startFakeSite(before())
  const second = await startFakeSite(after(), {}, 2000)
  second.slowCards = { template: "9002", afterMs: 1200 }
  t.after(async () => {
    await first.close()
    await second.close()
    await rm(base, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 })
  })
  assert.equal((await runCrawl(base, first)).code, 0)
  const run = await runCrawl(base, second, { READING_LIST_SETTLE_MS: "1500", READING_LIST_MAX_MS: "3000" })
  assert.equal(run.code, 1, run.out)
  assert.match(run.out, /the lesson list may be short: run it again/)
  assert.doesNotMatch(run.out, /Removed \d+ saved lesson/)
  assert.ok((await saved(base, "2")).some((record) => record.title === "Goes away"), "the lesson missing from the possibly short list is still saved")
  const manifest = JSON.parse(await readFile(path.join(base, "private", "crawl-test", "2.manifest.json"), "utf8")) as { complete?: boolean }
  assert.equal(manifest.complete, false, "the manifest of an unsettled listing is not trusted by a later prune")
})

test("the run after an untrusted run does not blame Google for what the short list missed", { timeout: 240_000 }, async (t) => {
  const base = await scratch()
  const first = await startFakeSite(before())
  const slow = await startFakeSite(after(), {}, 2000)
  slow.slowCards = { template: "9002", afterMs: 1200 }
  const plain = await startFakeSite(after(), {}, 2000)
  t.after(async () => {
    await first.close()
    await slow.close()
    await plain.close()
    await rm(base, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 })
  })
  assert.equal((await runCrawl(base, first)).code, 0)
  assert.equal((await runCrawl(base, slow, { READING_LIST_SETTLE_MS: "1500", READING_LIST_MAX_MS: "3000" })).code, 1)
  const run = await runCrawl(base, plain)
  assert.equal(run.code, 0, run.out)
  assert.match(run.out, /✔ 2\. Second Course/)
  assert.doesNotMatch(run.out, /Google changed this course: .*added/, "the baseline of the untrusted run was not used")
  assert.match(run.out, /Removed 1 saved lesson\(s\) Google no longer lists:\n {2}crawl-test 2\. Goes away/)
})

test("a run that stops part-way removes nothing, not even from the course it had already finished", { timeout: 240_000 }, async (t) => {
  const base = await scratch()
  const first = await startFakeSite({
    "9001": [{ title: "Stays lesson", kind: "bundle", text: ONE }, { title: "Goes first", kind: "bundle", text: "Synthetic text of a lesson of the first course that Google removes." }],
    "9002": [{ title: "Also stays", kind: "bundle", text: KEEP }, { title: "Goes away", kind: "bundle", text: GONE }],
  })
  const second = await startFakeSite({
    "9001": [{ title: "Stays lesson", kind: "bundle", text: ONE }],
    "9002": [{ title: "Also stays", kind: "bundle", text: KEEP }, { title: "Brand new lesson", kind: "bundle", text: NEW_LESSON }],
  }, {}, 2000)
  // The session ends while the second course is being read: the first course has finished and has a stale copy, the second stops.
  second.signedOutTemplates = ["9002"]
  t.after(async () => {
    await first.close()
    await second.close()
    await rm(base, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 })
  })
  assert.equal((await runCrawl(base, first)).code, 0)
  const run = await runCrawl(base, second)
  assert.equal(run.code, 1, run.out)
  assert.match(run.out, /■ STOPPED/)
  assert.match(run.out, /Stale saved lessons are removed only by a full run/)
  assert.doesNotMatch(run.out, /Removed \d+ saved lesson/)
  assert.ok((await saved(base, "1")).some((record) => record.title === "Goes first"), "the finished course was not pruned either, because the run was stopped")
  assert.ok((await saved(base, "2")).some((record) => record.title === "Goes away"))
})

test("a lesson card the crawl cannot read is named, and nothing is removed for its course", { timeout: 240_000 }, async (t) => {
  const base = await scratch()
  const first = await startFakeSite(before())
  const second = await startFakeSite({
    "9001": [{ title: "Stays lesson", kind: "bundle", text: ONE }],
    "9002": [{ title: "Also stays", kind: "bundle", text: KEEP }, { title: "", kind: "bundle", text: NEW_LESSON }],
  }, {}, 2000)
  t.after(async () => {
    await first.close()
    await second.close()
    await rm(base, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 })
  })
  assert.equal((await runCrawl(base, first)).code, 0)
  const run = await runCrawl(base, second)
  assert.equal(run.code, 0, "a card that cannot be read is a warning, not a failed run: " + run.out)
  assert.match(run.out, /✔ FINISHED: all 2 lessons[^\n]*\n {2}! 1 course with unread cards, shown below/, "the warning sits on its own line under the headline")
  assert.match(run.out, /! not read \(untitled, unknown type or no lesson link\):\n {8}\(untitled\)/)
  assert.match(run.out, /no saved lesson of this course is removed while they stay unread/)
  assert.doesNotMatch(run.out, /Removed \d+ saved lesson/)
  assert.match(run.out, /[✔✖] 2\. Second Course/)
  assert.doesNotMatch(run.out, /[✔✖] 2\. Second Course[\s\S]*Google changed this course/, "an untrusted list is not blamed on Google")
  assert.ok((await saved(base, "2")).some((record) => record.title === "Goes away"))
})

test("a lesson-page card of a type the crawl does not know is not ignored: its course is not pruned", { timeout: 240_000 }, async (t) => {
  const base = await scratch()
  const first = await startFakeSite(before())
  const second = await startFakeSite({
    "9001": [{ title: "Stays lesson", kind: "bundle", text: ONE }],
    "9002": [{ title: "Also stays", kind: "bundle", text: KEEP }, { title: "Goes away", kind: "odd-type", text: GONE }],
  }, {}, 2000)
  t.after(async () => {
    await first.close()
    await second.close()
    await rm(base, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 })
  })
  assert.equal((await runCrawl(base, first)).code, 0)
  const run = await runCrawl(base, second)
  assert.equal(run.code, 0, run.out)
  assert.match(run.out, /! not read \(untitled, unknown type or no lesson link\):\n {8}Goes away/)
  assert.doesNotMatch(run.out, /Removed \d+ saved lesson/)
  assert.ok((await saved(base, "2")).some((record) => record.title === "Goes away"), "Google still lists it, so its copy stays")
})

test("a course whose only lesson card cannot be read says so, instead of saying it has nothing to read", { timeout: 240_000 }, async (t) => {
  const base = await scratch()
  const first = await startFakeSite(before())
  const second = await startFakeSite({
    "9001": [{ title: "Stays lesson", kind: "bundle", text: ONE }],
    "9002": [{ title: "", kind: "bundle", text: NEW_LESSON }],
  }, {}, 2000)
  t.after(async () => {
    await first.close()
    await second.close()
    await rm(base, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 })
  })
  assert.equal((await runCrawl(base, first)).code, 0)
  const run = await runCrawl(base, second)
  assert.equal(run.code, 0, run.out)
  assert.match(run.out, /! not read \(untitled, unknown type or no lesson link\):\n {8}\(untitled\)/)
  assert.doesNotMatch(run.out, /no readable lessons/)
  assert.deepEqual((await saved(base, "2")).map((record) => record.title).sort(), ["Also stays", "Goes away"], "nothing was removed")
})

test("when every course has only unreadable cards the run still finishes, naming them, instead of saying the site lists no lessons", { timeout: 240_000 }, async (t) => {
  const base = await scratch()
  const first = await startFakeSite(before())
  const second = await startFakeSite({
    "9001": [{ title: "", kind: "bundle", text: ONE }, { title: "", kind: "bundle", text: KEEP }],
    "9002": [{ title: "", kind: "bundle", text: NEW_LESSON }],
  }, {}, 2000)
  t.after(async () => {
    await first.close()
    await second.close()
    await rm(base, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 })
  })
  assert.equal((await runCrawl(base, first)).code, 0)
  const run = await runCrawl(base, second)
  assert.equal(run.code, 0, run.out)
  assert.doesNotMatch(run.out, /lists no lessons|STOPPED|all 0 lessons/)
  assert.match(run.out, /! FINISHED, but no lesson could be read in 2 courses/)
  assert.match(run.out, /No lesson can be read: every lesson-like card is one the crawl cannot read/)
  assert.match(run.out, /! 2 courses with unread cards, shown below/)
  assert.match(run.out, /! not read \(untitled, unknown type or no lesson link\):\n {8}\(untitled\) x2/, "two untitled cards are counted, not shown once")
  assert.equal((await saved(base, "1")).length, 1, "nothing was removed from the first course")
  assert.equal((await saved(base, "2")).length, 2, "nothing was removed from the second course")
})

test("a lesson-page link on a credential card is not ignored: its course is not pruned", { timeout: 240_000 }, async (t) => {
  const base = await scratch()
  const first = await startFakeSite(before())
  const second = await startFakeSite({
    "9001": [{ title: "Stays lesson", kind: "bundle", text: ONE }],
    "9002": [{ title: "Also stays", kind: "bundle", text: KEEP }, { title: "Goes away", kind: "credential-type", text: GONE }],
  }, {}, 2000)
  t.after(async () => {
    await first.close()
    await second.close()
    await rm(base, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 })
  })
  assert.equal((await runCrawl(base, first)).code, 0)
  const run = await runCrawl(base, second)
  assert.equal(run.code, 0, run.out)
  assert.match(run.out, /! not read \(untitled, unknown type or no lesson link\):\n {8}Goes away/)
  assert.doesNotMatch(run.out, /Removed \d+ saved lesson/)
  assert.ok((await saved(base, "2")).some((record) => record.title === "Goes away"), "its saved copy stays")
})

test("a card of an unknown type with no lesson link is deliberately not counted: it cannot hold a saved copy, so the course is still pruned", { timeout: 240_000 }, async (t) => {
  const base = await scratch()
  const first = await startFakeSite(before())
  const second = await startFakeSite({
    "9001": [{ title: "Stays lesson", kind: "bundle", text: ONE }],
    "9002": [{ title: "Also stays", kind: "bundle", text: KEEP }, { title: "A lab of a new kind", other: "lab_v2" }],
  }, {}, 2000)
  t.after(async () => {
    await first.close()
    await second.close()
    await rm(base, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 })
  })
  assert.equal((await runCrawl(base, first)).code, 0)
  const run = await runCrawl(base, second)
  assert.equal(run.code, 0, run.out)
  assert.doesNotMatch(run.out, /not read/)
  assert.match(run.out, /Removed 1 saved lesson\(s\) Google no longer lists:\n {2}crawl-test 2\. Goes away/)
})

test("a course page that shows no card at all is not trusted: it is reported as incomplete", { timeout: 240_000 }, async (t) => {
  const base = await scratch()
  const first = await startFakeSite(before())
  const second = await startFakeSite({ "9001": [{ title: "Stays lesson", kind: "bundle", text: ONE }], "9002": [] }, {}, 2000)
  t.after(async () => {
    await first.close()
    await second.close()
    await rm(base, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 })
  })
  assert.equal((await runCrawl(base, first)).code, 0)
  const run = await runCrawl(base, second, { READING_LIST_WAIT_MS: "300", READING_LIST_MAX_MS: "300", READING_LIST_SETTLE_MS: "100" })
  assert.equal(run.code, 1, run.out)
  assert.match(run.out, /the lesson list may be short/)
  assert.deepEqual((await saved(base, "2")).map((record) => record.title).sort(), ["Also stays", "Goes away"])
})
