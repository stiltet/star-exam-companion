import assert from "node:assert/strict"
import { rm } from "node:fs/promises"
import test from "node:test"
import { browserMissing } from "./browser-test.ts"
import { after, before, noLessonText, runCrawl, saved, scratch } from "./crawl-run-helpers.ts"
import { startFakeSite } from "./fake-lesson-site.ts"

// One of the files the crawl command's tests are split into, so `node --test` runs them at the same time. The shared set-up is crawl-run-helpers.ts.

test("a finished crawl removes the saved copy of a lesson Google no longer lists, names it, and leaves the other courses alone", { timeout: 240_000, skip: browserMissing }, async (t) => {
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

test("a course page that fills in its cards late is read once the count settles, and what it lists is trusted", { timeout: 240_000, skip: browserMissing }, async (t) => {
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
