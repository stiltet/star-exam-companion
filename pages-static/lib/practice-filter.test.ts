import assert from "node:assert/strict"
import test from "node:test"
import type { Question } from "./exam-data.ts"
import { practiceFilter, practiceLink } from "./practice-filter.ts"

const q = (id: string, sectionId: string, topicId: string) => ({ id, sectionId, topicId }) as unknown as Question
const questions = [q("a", "1", "t1"), q("b", "1", "t2"), q("c", "2", "t3")]

test("no query keeps every question and the key is all", () => {
  const result = practiceFilter(questions, {})
  assert.equal(result.filtered.length, 3)
  assert.equal(result.key, "all")
  assert.equal(result.onlyUnanswered, false)
})

test("a section keeps that section's questions", () => {
  const result = practiceFilter(questions, { section: "1" })
  assert.deepEqual(result.filtered.map((x) => x.id), ["a", "b"])
  assert.equal(result.key, "section=1")
})

test("a topic wins over a section", () => {
  const result = practiceFilter(questions, { topic: "t3", section: "1" })
  assert.deepEqual(result.filtered.map((x) => x.id), ["c"])
  assert.equal(result.key, "topic=t3")
})

test("the Unanswered switch is part of the key and combines with a section", () => {
  const result = practiceFilter(questions, { section: "2", unanswered: "1" })
  assert.equal(result.onlyUnanswered, true)
  assert.equal(result.key, "section=2&unanswered=1")
  assert.deepEqual(result.filtered.map((x) => x.id), ["c"])
})

test("where the switch is not allowed, such as the online demo, it is ignored", () => {
  const result = practiceFilter(questions, { unanswered: "1" }, false)
  assert.equal(result.onlyUnanswered, false)
  assert.equal(result.key, "all")
})

test("a filter that matches nothing gives an empty list", () => {
  assert.deepEqual(practiceFilter(questions, { topic: "none" }).filtered, [])
})

test("links keep the Unanswered switch and the place", () => {
  assert.equal(practiceLink({}, false), "/practice")
  assert.equal(practiceLink({}, true), "/practice?unanswered=1")
  assert.equal(practiceLink({ section: "2" }, true), "/practice?section=2&unanswered=1")
  assert.equal(practiceLink({ topic: "ml basics" }, false), "/practice?topic=ml+basics")
})
