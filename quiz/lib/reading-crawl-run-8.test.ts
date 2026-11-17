import assert from "node:assert/strict"
import { rm } from "node:fs/promises"
import test from "node:test"
import { browserMissing } from "./browser-test.ts"
import { GONE, KEEP, NEW_LESSON, ONE, after, before, runCrawl, saved, scratch } from "./crawl-run-helpers.ts"
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
