import assert from "node:assert/strict"
import test from "node:test"
import { examDuration, filterRows, retakeIds, reviewHash, reviewId, reviewRows, shuffle } from "./exam-review.ts"

const questions = new Map([
  ["a", { correctIndex: 0 }],
  ["b", { correctIndex: 1 }],
  ["c", { correctIndex: 2 }],
  ["d", { correctIndex: 3 }],
])

test("each question of an exam is right, wrong or unanswered, with its flag and number", () => {
  const rows = reviewRows(questions, { asked: ["a", "b", "c", "d"], missed: ["b", "c"], answers: { a: 0, b: 0, d: 3 }, flagged: ["a", "c"] })
  assert.deepEqual(rows.map((row) => [row.number, row.id, row.status, row.chosen, row.flagged]), [
    [1, "a", "right", 0, true],
    [2, "b", "wrong", 0, false],
    [3, "c", "unanswered", null, true],
    [4, "d", "right", 3, false],
  ])
})

test("an exam saved before answers were kept still shows which were missed", () => {
  const rows = reviewRows(questions, { asked: ["a", "b"], missed: ["b"] })
  assert.deepEqual(rows.map((row) => [row.status, row.chosen, row.flagged]), [["right", undefined, false], ["wrong", undefined, false]])
})

test("a question no longer in the bank is kept, marked as gone", () => {
  const [row] = reviewRows(questions, { asked: ["gone"], missed: ["gone"], answers: { gone: 1 } })
  assert.equal(row?.gone, true)
  assert.equal(row?.status, "wrong")
})

test("the filters pick wrong, flagged and unanswered questions", () => {
  const rows = reviewRows(questions, { asked: ["a", "b", "c", "d"], missed: ["b", "c"], answers: { a: 0, b: 0, d: 3 }, flagged: ["a", "c"] })
  const ids = (filter: Parameters<typeof filterRows>[1]) => filterRows(rows, filter).map((row) => row.id)
  assert.deepEqual(ids("all"), ["a", "b", "c", "d"])
  assert.deepEqual(ids("wrong"), ["b", "c"], "an unanswered question counts as wrong")
  assert.deepEqual(ids("flagged"), ["a", "c"])
  assert.deepEqual(ids("unanswered"), ["c"])
})

test("a retake asks the wrong and flagged questions still in the bank, in exam order", () => {
  assert.deepEqual(retakeIds({ asked: ["a", "b", "c", "d", "gone"], missed: ["c", "gone"], flagged: ["a"] }, new Set(questions.keys())), ["a", "c"])
})

test("a shorter exam gets the same time per question as the full one", () => {
  assert.equal(examDuration(60), 5400)
  assert.equal(examDuration(10), 900)
  assert.equal(examDuration(0), 90)
})

test("a review is opened by its exam id in the address hash", () => {
  assert.equal(reviewHash("abc"), "#review=abc")
  assert.equal(reviewId("#review=abc"), "abc")
  assert.equal(reviewId("#other"), null)
  assert.equal(reviewId(""), null)
  assert.equal(reviewId("#review=%E0%A4%A"), null, "a broken hash opens nothing rather than failing")
})

test("the shuffle keeps every item once", () => {
  const values = Array.from({ length: 50 }, (_, n) => n)
  const mixed = shuffle(values, () => 0.3)
  assert.deepEqual([...mixed].sort((a, b) => a - b), values)
  assert.notDeepEqual(mixed, values)
  assert.deepEqual(values, Array.from({ length: 50 }, (_, n) => n), "the input is not changed")
})
