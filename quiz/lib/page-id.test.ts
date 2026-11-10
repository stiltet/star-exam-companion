import assert from "node:assert/strict"
import test from "node:test"
import { acceptAnswer } from "./score.ts"
import { isPrivateReadingInput } from "./private-reading.ts"
import { MAX_PAGE_ID_DIGITS, PRIVATE_PAGE_ID } from "./page-id.ts"

test("a page id is 1 to 20 digits, the size of a 64-bit number", () => {
  assert.equal(MAX_PAGE_ID_DIGITS, 20)
  assert.equal("18446744073709551615".length, MAX_PAGE_ID_DIGITS, "the largest 64-bit number has this many digits")
  for (const id of ["0", "7", "98001", "18446744073709551615", "9".repeat(20)]) assert.equal(PRIVATE_PAGE_ID.test(id), true, id)
  for (const id of ["", "a", "1a", "-1", "1.5", " 1", "9".repeat(21), "٣"]) assert.equal(PRIVATE_PAGE_ID.test(id), false, id)
})

test("the private store and the saved progress accept exactly the same page ids", () => {
  const now = Date.parse("2026-10-01T12:00:00.000Z")
  const known = { bankIds: new Set<string>(), termNames: new Set<string>(), examLength: { questions: 60, minutes: 90 }, courseIds: ["12"] }
  const progress = (id: string) => acceptAnswer({
    id: "6400a46c-9655-4d5e-8e84-b8d61bf4f194", at: "2026-10-01T11:00:00.000Z", mode: "reading", asked: [`12/${id}`], missed: [],
  }, known, now) !== null
  const store = (id: string) => isPrivateReadingInput({ pageId: id, title: "Synthetic", text: "Synthetic text." })
  for (const id of ["1", "98001", "18446744073709551615", "9".repeat(21), "abc", ""]) {
    assert.equal(progress(id), store(id), `store and progress disagree about "${id}"`)
  }
})
