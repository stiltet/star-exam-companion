import assert from "node:assert/strict"
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"
import { browserMissing } from "./browser-test.ts"
import { after, before, browserClosed, noLessonText, runCrawl, saved, scratch } from "./crawl-run-helpers.ts"
import { startFakeSite } from "./fake-lesson-site.ts"

// One of the files the crawl command's tests are split into, so `node --test` runs them at the same time. The shared set-up is crawl-run-helpers.ts.

test("when the browser's account prompt does not appear, the crawl presses Sign in and Sign in with Google itself", { timeout: 240_000, skip: browserMissing }, async (t) => {
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

test("a course that holds only labs, videos and quizzes is named as having nothing to read, and the crawl still finishes", { timeout: 240_000, skip: browserMissing }, async (t) => {
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

test("a video lesson is saved by its title in its place among the readings, and its page is never opened", { timeout: 240_000, skip: browserMissing }, async (t) => {
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

test("when the signed-in account is the one asked for, the crawl goes on, whatever the case of the address", { timeout: 240_000, skip: browserMissing }, async (t) => {
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

test("a course whose manifest was made under an older listing rule is not compared, the run logs that, and Google is not blamed", { timeout: 240_000, skip: browserMissing }, async (t) => {
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
