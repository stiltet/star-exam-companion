import assert from "node:assert/strict"
import { readFile, rm } from "node:fs/promises"
import path from "node:path"
import test, { after as afterAll } from "node:test"
import { browserMissing } from "./browser-test.ts"
import { after, before, runCrawl, saved, scratch } from "./crawl-run-helpers.ts"
import { startFakeSite, type FakeSite } from "./fake-lesson-site.ts"

// One of the files the crawl command's tests are split into, so `node --test` runs them at the same time. The shared set-up is crawl-run-helpers.ts.

// The three tests are one story told in order on one store: a full run, then a run whose list is still changing, then a plain run.
// They share the fake sites and the scratch folder, so each test is one run of the command.
let base = ""
let first: FakeSite | undefined
let slow: FakeSite | undefined
let plain: FakeSite | undefined
afterAll(async () => {
  await first?.close()
  await slow?.close()
  await plain?.close()
  if (base) await rm(base, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 })
})

test("a first full run saves both courses", { timeout: 240_000, skip: browserMissing }, async () => {
  base = await scratch()
  first = await startFakeSite(before())
  slow = await startFakeSite(after(), {}, 2000)
  slow.slowCards = { template: "9002", afterMs: 1200 }
  plain = await startFakeSite(after(), {}, 2000)
  assert.equal((await runCrawl(base, first)).code, 0)
})

test("a course page still changing after the longest wait is reported as unsettled, and nothing is pruned for it", { timeout: 240_000, skip: browserMissing }, async () => {
  assert.ok(base && slow, "this test continues the set-up run before it: run the whole file, not this test alone")
  const run = await runCrawl(base, slow, { READING_LIST_SETTLE_MS: "1500", READING_LIST_MAX_MS: "3000" })
  assert.equal(run.code, 1, run.out)
  assert.match(run.out, /the lesson list may be short: run it again/)
  assert.doesNotMatch(run.out, /Removed \d+ saved lesson/)
  assert.ok((await saved(base, "2")).some((record) => record.title === "Goes away"), "the lesson missing from the possibly short list is still saved")
  const manifest = JSON.parse(await readFile(path.join(base, "private", "crawl-test", "2.manifest.json"), "utf8")) as { complete?: boolean }
  assert.equal(manifest.complete, false, "the manifest of an unsettled listing is not trusted by a later prune")
})

test("the run after an untrusted run does not blame Google for what the short list missed", { timeout: 240_000, skip: browserMissing }, async () => {
  assert.ok(base && plain, "this test continues the runs before it: run the whole file, not this test alone")
  const run = await runCrawl(base, plain)
  assert.equal(run.code, 0, run.out)
  assert.match(run.out, /✔ 2\. Second Course/)
  assert.doesNotMatch(run.out, /Google changed this course: .*added/, "the baseline of the untrusted run was not used")
  assert.match(run.out, /Removed 1 saved lesson\(s\) Google no longer lists:\n {2}crawl-test 2\. Goes away/)
})
