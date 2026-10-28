import assert from "node:assert/strict"
import test from "node:test"
import { CARDS_KEY, cardsResume, clearDeviceSessions, EXAM_KEY, examOutcome, examResume, examSeconds, loadState, practiceKey, practicePlace, saveState, secondsLeft } from "./resume.ts"

function memory() {
  const data = new Map<string, string>()
  return { data, getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => void data.set(key, value), removeItem: (key: string) => void data.delete(key) }
}

test("a saved place is read back, a torn one is none, and saving null removes it", () => {
  const store = memory()
  saveState(store, "k", { id: "a" })
  assert.deepEqual(loadState(store, "k"), { id: "a" })
  store.setItem("k", "{torn")
  assert.equal(loadState(store, "k"), null)
  saveState(store, "k", null)
  assert.equal(store.data.has("k"), false)
  const full = { getItem: () => null, setItem: () => { throw new Error("full") }, removeItem: () => undefined }
  assert.doesNotThrow(() => saveState(full, "k", { id: "a" }))
})

test("practice keeps the last question and its choices, per filter", () => {
  assert.notEqual(practiceKey("all"), practiceKey("section=2"))
  const ids = ["a", "b", "c"]
  assert.deepEqual(practicePlace(ids, { id: "b", picked: { a: 1, b: 3 } }), { index: 1, picked: { a: 1, b: 3 } })
  assert.deepEqual(practicePlace(ids, { id: "gone", picked: { gone: 1, a: 9, c: 0 } }), { index: 0, picked: { c: 0 } })
  assert.deepEqual(practicePlace(ids, null), { index: 0, picked: {} })
})

const bank = new Set(["a", "b", "c"])
const exam = { ids: ["a", "b"], answers: { a: 2 }, flagged: ["b"], index: 1, state: "active", startedAt: 1_000, endsAt: 5_401_000 }

test("an exam in progress resumes with its answers, flags and clock", () => {
  assert.deepEqual(examResume(exam, bank), { ...exam, retake: false }, "an exam kept before retakes is a practice exam")
  assert.equal(secondsLeft(exam.endsAt, exam.startedAt + 60_000), 5340)
  assert.equal(examResume({ ...exam, ids: ["a", "gone"] }, bank), null, "a question no longer in the glossary")
  assert.equal(examResume({ ...exam, index: 2 }, bank), null)
  assert.equal(examResume({ ...exam, state: "results" }, bank), null)
  assert.equal(examResume({ ...exam, endsAt: 0 }, bank), null)
})

test("an exam whose time ran out while closed finishes with the answers given", () => {
  const resumed = examResume(exam, bank)
  assert.ok(resumed)
  const later = exam.endsAt + 3_600_000
  assert.equal(secondsLeft(resumed.endsAt, later), 0)
  assert.equal(examSeconds(resumed.startedAt, later, 5400), 5400)
  const questions = [{ id: "a", correctIndex: 2 }, { id: "b", correctIndex: 0 }]
  assert.deepEqual(examOutcome(questions, resumed.answers), { asked: ["a", "b"], missed: ["b"] })
})

test("flashcards resume where they were, and start afresh if a term has gone", () => {
  const terms = new Set(["Grounding", "Gems"])
  const saved = { category: "all", order: ["Gems", "Grounding"], index: 1, known: ["Gems"] }
  assert.deepEqual(cardsResume(saved, terms), saved)
  assert.equal(cardsResume({ ...saved, order: ["Gems", "Vertex AI"] }, terms), null)
  assert.equal(cardsResume({ ...saved, index: 2 }, terms), null)
  assert.equal(cardsResume({ ...saved, known: "Gems" }, terms), null)
})

test("a reset clears every mode's place on the device and leaves the rest", () => {
  const data = new Map([[practiceKey("all"), "{}"], [practiceKey("section=2"), "{}"], [EXAM_KEY, "{}"], [CARDS_KEY, "{}"], ["quiz-outbox", "[]"]])
  const store = { get length() { return data.size }, key: (index: number) => [...data.keys()][index] ?? null, removeItem: (key: string) => void data.delete(key) }
  clearDeviceSessions(store)
  assert.deepEqual([...data.keys()], ["quiz-outbox"])
})

test("an exam in progress remembers that it is a retake", () => {
  const kept = { ids: ["a"], answers: {}, flagged: [], index: 0, state: "active", startedAt: 1, endsAt: 2 }
  assert.equal(examResume({ ...kept, retake: true }, new Set(["a"]))?.retake, true)
  assert.equal(examResume(kept, new Set(["a"]))?.retake, false)
})
