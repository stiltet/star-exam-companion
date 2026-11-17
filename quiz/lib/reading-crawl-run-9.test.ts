import assert from "node:assert/strict"
import { rm } from "node:fs/promises"
import test from "node:test"
import { browserMissing } from "./browser-test.ts"
import { GONE, KEEP, NEW_LESSON, ONE, after, before, runCrawl, saved, scratch } from "./crawl-run-helpers.ts"
import { startFakeSite } from "./fake-lesson-site.ts"

// One of the files the crawl command's tests are split into, so `node --test` runs them at the same time. The shared set-up is crawl-run-helpers.ts.

test("when every course has only unreadable cards the run still finishes, naming them, instead of saying the site lists no lessons", { timeout: 240_000, skip: browserMissing }, async (t) => {
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

test("a lesson-page link on a credential card is not ignored: its course is not pruned", { timeout: 240_000, skip: browserMissing }, async (t) => {
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
