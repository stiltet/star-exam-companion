import assert from "node:assert/strict"
import { rm } from "node:fs/promises"
import test, { after as afterAll } from "node:test"
import { browserMissing } from "./browser-test.ts"
import { DOCUMENT, INTRO, PDF, REPEAT_ONE, REPEAT_TWO, SETTLED, after, browserClosed, noLessonText, runCrawl, saved, scratch } from "./crawl-run-helpers.ts"
import { startFakeSite, type FakeCard, type FakeSite } from "./fake-lesson-site.ts"

// One of the files the crawl command's tests are split into, so `node --test` runs them at the same time. The shared set-up is crawl-run-helpers.ts.

let sharedBase = ""
let sharedSite: FakeSite | undefined
afterAll(async () => {
  await sharedSite?.close()
  if (sharedBase) await rm(sharedBase, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 })
})

test("a lesson that Google changed is read again and saved over the old copy, first run", { timeout: 240_000, skip: browserMissing }, async () => {
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

  const first = await runCrawl(sharedBase, sharedSite as FakeSite)
  assert.equal(first.code, 0, first.out)
})

test("a lesson that Google changed is read again and saved over the old copy", { timeout: 240_000, skip: browserMissing }, async () => {
  const base = sharedBase
  const site = sharedSite as FakeSite
  const changed = "Synthetic changed intro text that is long enough to be a reading."
  site.setText("Intro bundle", changed)
  const run = await runCrawl(base, site)
  assert.equal(run.code, 0, run.out)
  assert.match(run.out, /4 lessons: 0 new, 1 updated, 3 unchanged/)
  noLessonText(run, [changed])
  const first = await saved(base, "1")
  assert.equal(first.length, 4, "the lesson is replaced, not added again")
  assert.equal(first.find((record) => record.title === "Intro bundle")?.text, changed)
})

test("a lesson with no text and a request that fails once are both reported, and the verdict is NOT FINISHED", { timeout: 240_000, skip: browserMissing }, async (t) => {
  const base = await scratch()
  const retryText = "Synthetic text of the lesson whose first request is cut off."
  const fineText = "Synthetic text of a lesson that simply works, long enough to count."
  const site = await startFakeSite({
    "9001": [
      { title: "Dropped once", kind: "drop-first", text: retryText },
      { title: "Empty lesson", kind: "notext", text: "Short" },
    ],
    "9002": [{ title: "Fine lesson", kind: "bundle", text: fineText }],
  })
  t.after(async () => {
    await site.close()
    await rm(base, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 })
  })
  const run = await runCrawl(base, site)
  assert.equal(run.code, 1, run.out)
  assert.match(run.out, /retry 2 of 5: Dropped once/)
  assert.match(run.out, /✖ NOT FINISHED: 1 of 2 courses incomplete/)
  assert.match(run.out, /✖ 1\. First Course\n {6}2 lessons: 1 new, 0 updated, 0 unchanged\n {6}✖ no reading text: Empty lesson/)
  assert.match(run.out, /✔ 2\. Second Course/)
  noLessonText(run, [retryText, fineText])
  assert.deepEqual((await saved(base, "1")).map((record) => record.title), ["Dropped once"], "the dropped request was tried again and saved")
  assert.equal((await saved(base, "2")).length, 1)
  assert.equal(await browserClosed(run.port), true)
})
