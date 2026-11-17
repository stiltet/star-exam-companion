import assert from "node:assert/strict"
import { rm } from "node:fs/promises"
import test from "node:test"
import { browserMissing } from "./browser-test.ts"
import { KEEP, ONE, after, before, runCrawl, saved, scratch } from "./crawl-run-helpers.ts"
import { startFakeSite } from "./fake-lesson-site.ts"

// One of the files the crawl command's tests are split into, so `node --test` runs them at the same time. The shared set-up is crawl-run-helpers.ts.

test("a card of an unknown type with no lesson link is deliberately not counted: it cannot hold a saved copy, so the course is still pruned", { timeout: 240_000, skip: browserMissing }, async (t) => {
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

test("a course page that shows no card at all is not trusted: it is reported as incomplete", { timeout: 240_000, skip: browserMissing }, async (t) => {
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
