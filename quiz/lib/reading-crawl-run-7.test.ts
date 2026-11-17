import assert from "node:assert/strict"
import { rm } from "node:fs/promises"
import test from "node:test"
import { browserMissing } from "./browser-test.ts"
import { GONE, KEEP, NEW_LESSON, ONE, after, before, runCrawl, saved, scratch } from "./crawl-run-helpers.ts"
import { startFakeSite } from "./fake-lesson-site.ts"

// One of the files the crawl command's tests are split into, so `node --test` runs them at the same time. The shared set-up is crawl-run-helpers.ts.

test("a run that stops part-way removes nothing, not even from the course it had already finished", { timeout: 240_000, skip: browserMissing }, async (t) => {
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

test("a lesson card the crawl cannot read is named, and nothing is removed for its course", { timeout: 240_000, skip: browserMissing }, async (t) => {
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
