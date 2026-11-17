import assert from "node:assert/strict"
import { readFile, readdir, rm } from "node:fs/promises"
import path from "node:path"
import test from "node:test"
import { browserMissing } from "./browser-test.ts"
import { DOCUMENT, INTRO, PDF, REPEAT_ONE, REPEAT_TWO, SETTLED, after, before, browserClosed, noLessonText, runCrawl, saved, scratch } from "./crawl-run-helpers.ts"
import { startFakeSite, type FakeCard } from "./fake-lesson-site.ts"

// One of the files the crawl command's tests are split into, so `node --test` runs them at the same time. The shared set-up is crawl-run-helpers.ts.

test("a crawl run with --debug also logs the addresses and the reads, still with no lesson text", { timeout: 240_000, skip: browserMissing }, async (t) => {
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

  const first = await runCrawl(base, site)
  assert.equal(first.code, 0, first.out)

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
})

test("a signed-out visitor stops the crawl with a clear message and nothing is saved", { timeout: 240_000, skip: browserMissing }, async (t) => {
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

test("a site that lists no lessons stops the crawl and says so, instead of ending silently", { timeout: 240_000, skip: browserMissing }, async (t) => {
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

test("when another Google account is signed in than the one asked for, the crawl stops before it opens a lesson", { timeout: 240_000, skip: browserMissing }, async (t) => {
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

test("when the settings page shows more than one address, the crawl cannot tell which is the account's own and stops, if an account was asked for", { timeout: 240_000, skip: browserMissing }, async (t) => {
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
