import assert from "node:assert/strict"
import { readFile, readdir, rm } from "node:fs/promises"
import path from "node:path"
import test, { after as afterAll } from "node:test"
import { browserMissing } from "./browser-test.ts"
import { DOCUMENT, INTRO, PDF, REPEAT_ONE, REPEAT_TWO, SETTLED, after, browserClosed, noLessonText, runCrawl, saved, scratch } from "./crawl-run-helpers.ts"
import { startFakeSite, type FakeCard, type FakeSite } from "./fake-lesson-site.ts"

// One of the files the crawl command's tests are split into, so `node --test` runs them at the same time. The shared set-up is crawl-run-helpers.ts.

test("the first crawl run saves every lesson, reports plainly and logs without lesson text", { timeout: 240_000, skip: browserMissing }, async (t) => {
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
})

let sharedBase = ""
let sharedSite: FakeSite | undefined
afterAll(async () => {
  await sharedSite?.close()
  if (sharedBase) await rm(sharedBase, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 })
})

test("a second crawl run with nothing new changes nothing (set-up run)", { timeout: 240_000, skip: browserMissing }, async () => {
  sharedBase = await scratch()
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
  sharedSite = await startFakeSite(courses)

  const first = await runCrawl(sharedBase, sharedSite)
  assert.equal(first.code, 0, first.out)
})

test("a second crawl run with nothing new changes nothing", { timeout: 240_000, skip: browserMissing }, async () => {
  assert.ok(sharedSite, "this test continues the set-up run before it: run the whole file, not this test alone")
  const base = sharedBase
  const site = sharedSite
  const run = await runCrawl(base, site)
  assert.equal(run.code, 0, run.out)
  assert.match(run.out, /✔ FINISHED/)
  assert.match(run.out, /4 lessons: 0 new, 0 updated, 4 unchanged/)
  assert.match(run.out, /2 lessons: 0 new, 0 updated, 2 unchanged/)
})
