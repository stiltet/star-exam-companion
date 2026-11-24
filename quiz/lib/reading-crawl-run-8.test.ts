import assert from "node:assert/strict"
import { rm } from "node:fs/promises"
import test from "node:test"
import { browserMissing } from "./browser-test.ts"
import { GONE, KEEP, NEW_LESSON, ONE, after, before, browserClosed, noLessonText, runCrawl, saved, scratch } from "./crawl-run-helpers.ts"
import { startFakeSite } from "./fake-lesson-site.ts"

// One of the files the crawl command's tests are split into, so `node --test` runs them at the same time. The shared set-up is crawl-run-helpers.ts.

test("a lesson-page card of a type the crawl does not know is not ignored: its course is not pruned", { timeout: 240_000, skip: browserMissing }, async (t) => {
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

test("a course whose only lesson card cannot be read says so, instead of saying it has nothing to read", { timeout: 240_000, skip: browserMissing }, async (t) => {
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
