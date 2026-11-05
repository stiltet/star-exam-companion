import assert from "node:assert/strict"
import test from "node:test"
import { acceptAnswer, acceptBatch, examSeconds, MAX_BATCH, storeAnswers } from "./score.ts"
import type { ScoreLine } from "./learn.ts"
import { readFileSync } from "node:fs"
import { itemsFromGlossary } from "./round.ts"
import { parseGlossary } from "./sources.ts"
import { practiceItems, writtenPool } from "./questions.ts"
import { testBank, testPack } from "./test-pack.ts"

const origin = "http://localhost"
const now = Date.parse("2026-10-01T12:00:00.000Z")
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`
const answer = (n: number, extra: Record<string, unknown> = {}) => ({ id: id(n), at: "2026-10-01T11:00:00.000Z", mode: "round", asked: ["a"], missed: [], ...extra })
// The first exam pack's length and courses, as its pack.json and courses.json give them.
const DEFAULT_EXAM_LENGTH = { questions: 60, minutes: 90 }
const known = { bankIds: new Set(["a", "b"]), termNames: new Set(["Grounding"]), examLength: DEFAULT_EXAM_LENGTH, courseIds: ["1", "2", "3", "4", "5"] }
const batch = (answers: unknown[]) => ({ origin, contentType: "application/json", body: { answers }, allowedOrigin: origin, ...known, now })

test("a batch is accepted only as same-origin JSON { answers } of 1 to 500", () => {
  assert.equal(acceptBatch(batch([answer(1)])).ok, true)
  const unknown = acceptBatch(batch([{ ...answer(1), asked: ["a-removed-question"] }]))
  assert.deepEqual(unknown.ok && [unknown.rejected, unknown.gone], [[answer(1).id], [answer(1).id]])
  // A round id the round pool lacks but the bank has is refused and kept, not gone.
  const narrow = acceptBatch({ ...batch([answer(1, { asked: ["b"] })]), roundIds: new Set(["a"]) })
  assert.deepEqual(narrow.ok && [narrow.rejected, narrow.gone], [[answer(1).id], []])
  const invalid = acceptBatch(batch([{ ...answer(1), missed: ["zzz"] }]))
  assert.deepEqual(invalid.ok && [invalid.rejected, invalid.gone], [[answer(1).id], []])
  assert.equal(acceptBatch({ ...batch([answer(1)]), origin: "http://evil.example" }).ok, false)
  assert.equal(acceptBatch({ ...batch([answer(1)]), contentType: "text/plain" }).ok, false)
  assert.equal(acceptBatch({ ...batch([answer(1)]), body: { answers: [answer(1)], extra: 1 } }).ok, false)
  assert.equal(acceptBatch(batch([])).ok, false)
  assert.equal(acceptBatch(batch(Array.from({ length: MAX_BATCH + 1 }, (_, n) => answer(n)))).ok, false)
})

test("a malformed answer is rejected by id and the rest of the batch still counts", () => {
  const result = acceptBatch(batch([answer(1), answer(2, { asked: ["zzz"] }), { id: "not-an-id" }]))
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.deepEqual(result.answers.map((item) => item.id), [id(1)])
  assert.deepEqual(result.rejected, [id(2)])
})

test("each mode is checked by its own rule", () => {
  const check = (value: unknown) => acceptAnswer(value, known, now) !== null
  assert.equal(check(answer(1, { mode: "practice", missed: ["a"] })), true)
  assert.equal(check(answer(1, { asked: ["a", "b"] })), false, "one question per round line")
  assert.equal(check(answer(1, { missed: ["b"] })), false, "only the asked question can be missed")
  assert.equal(check(answer(1, { mode: "flashcard", asked: ["Grounding"], missed: ["Grounding"] })), true)
  assert.equal(check(answer(1, { mode: "flashcard", asked: ["a"] })), false, "a flashcard names a glossary term")
  assert.equal(check(answer(1, { mode: "exam", asked: ["a", "b"], missed: ["b"], seconds: 600 })), true)
  assert.equal(check(answer(1, { mode: "exam", asked: ["a", "a"], missed: [], seconds: 600 })), false)
  assert.equal(check(answer(1, { mode: "exam", asked: ["a"], missed: [], seconds: examSeconds(DEFAULT_EXAM_LENGTH) + 1 })), false)
  assert.equal(check(answer(1, { mode: "exam", asked: ["a"], missed: [] })), false, "an exam says how long it took")
  assert.equal(check(answer(1, { seconds: 5 })), false, "only an exam has seconds")
  assert.equal(check(answer(1, { mode: "quiz" })), false)
  assert.equal(check(answer(1, { note: "x" })), false)
})

test("an exam keeps its chosen answers and flags, so it can be reviewed later", () => {
  const exam = (extra: Record<string, unknown>) => acceptAnswer(answer(1, { mode: "exam", asked: ["a", "b"], missed: ["b"], seconds: 600, ...extra }), known, now)
  assert.deepEqual(exam({ answers: { a: 0, b: 3 }, flagged: ["b"] })?.answers, { a: 0, b: 3 })
  assert.deepEqual(exam({ answers: { a: 0 }, flagged: [] })?.flagged, [])
  assert.ok(exam({}), "an exam saved before 27 Oct has neither")
  assert.equal(exam({ answers: { c: 0 } }), null, "an answer to a question not asked")
  assert.equal(exam({ answers: { a: -1 } }), null)
  assert.equal(exam({ answers: { a: 1.5 } }), null)
  assert.equal(exam({ answers: [0, 1] }), null)
  assert.equal(exam({ flagged: ["c"] }), null, "a flag on a question not asked")
  assert.equal(exam({ flagged: ["a", "a"] }), null)
  assert.equal(exam({ answers: { b: 1 } }), null, "a question left blank must count as missed")
  assert.equal(acceptAnswer(answer(1, { mode: "practice", answers: { a: 0 } }), known, now), null, "only an exam keeps answers")
})

test("a retake is an exam line marked as a retake, and keeps the mark", () => {
  const exam = (extra: Record<string, unknown>) => acceptAnswer(answer(1, { mode: "exam", asked: ["a"], missed: [], seconds: 60, ...extra }), known, now)
  assert.equal(exam({ retake: true })?.retake, true)
  assert.equal(exam({})?.retake, undefined)
  assert.equal(exam({ retake: false }), null, "only true marks a retake")
  assert.equal(acceptAnswer(answer(1, { mode: "practice", retake: true }), known, now), null, "only an exam can be a retake")
  const [line] = storeAnswers([], [{ id: id(8), at: "2026-10-01T11:00:00.000Z", mode: "exam", asked: ["a"], missed: [], seconds: 60, retake: true }]).lines
  assert.equal(line?.retake, true)
})

test("an exam's answers and flags reach its saved line", () => {
  const exam = { id: id(9), at: "2026-10-01T11:00:00.000Z", mode: "exam" as const, asked: ["a", "b"], missed: ["b"], seconds: 60, answers: { a: 0 }, flagged: ["b"] }
  const [line] = storeAnswers([], [exam]).lines
  assert.deepEqual(line?.answers, { a: 0 })
  assert.deepEqual(line?.flagged, ["b"])
})

test("a reading read is saved as its course and page, never as missed", () => {
  const check = (value: unknown) => acceptAnswer(value, known, now) !== null
  assert.equal(check(answer(1, { mode: "reading", asked: ["2/6899cc1b05fa90817c63cc5e"] })), true)
  assert.equal(check(answer(1, { mode: "reading", asked: ["2/6899cc1b05fa90817c63cc5e"], missed: ["2/6899cc1b05fa90817c63cc5e"] })), false)
  assert.equal(check(answer(1, { mode: "reading", asked: ["9/6899cc1b05fa90817c63cc5e"] })), false, "course 9 does not exist")
  assert.equal(check(answer(1, { mode: "reading", asked: ["2/../../etc"] })), false)
  assert.equal(check(answer(1, { mode: "reading", asked: ["a"] })), false)
})

test("a pack with no course accepts no reading, instead of matching any course", () => {
  const noCourses = { ...known, courseIds: [] }
  assert.equal(acceptAnswer(answer(1, { mode: "reading", asked: ["2/6899cc1b05fa90817c63cc5e"] }), noCourses, now) !== null, false)
  assert.equal(acceptAnswer(answer(1, { mode: "reading", asked: ["/6899cc1b05fa90817c63cc5e"] }), noCourses, now) !== null, false)
})

test("the server accepts all 241 voice and 111 written questions in the modes that offer them", () => {
  const parsed = parseGlossary(testPack.glossaryText)
  assert.ok(parsed.ok)
  if (!parsed.ok) return
  const items = itemsFromGlossary(parsed.glossary, testPack.scenes)
  const bank = practiceItems(items, writtenPool(testBank))
  const pools = {
    bankIds: new Set(bank.map((item) => item.id)),
    roundIds: new Set(items.map((item) => item.id)),
    termNames: new Set(parsed.glossary.terms.map((term) => term.term)),
    examLength: testPack.meta.exam,
    courseIds: testPack.courses.map((course) => course.id),
  }
  assert.equal(bank.length - items.length, 111)
  for (const item of bank) {
    assert.ok(acceptAnswer(answer(1, { mode: "practice", asked: [item.id], missed: [item.id] }), pools, now), item.id)
    assert.ok(acceptAnswer(answer(1, { mode: "exam", asked: [item.id], seconds: 60 }), pools, now), item.id)
    assert.equal(acceptAnswer(answer(1, { asked: [item.id] }), pools, now) !== null, pools.roundIds.has(item.id), item.id)
  }
  assert.ok(acceptAnswer(answer(1, { mode: "exam", asked: [items[0]!.id, "q1"], missed: ["q1"], seconds: 90 }), pools, now))
  assert.equal(acceptAnswer(answer(1, { mode: "practice", asked: ["unknown-question"] }), pools, now), null)
  assert.equal(acceptAnswer(answer(1, { mode: "flashcard", asked: ["q1"] }), pools, now), null)
})

test("refusal responses include specific reasons without changing the rejected ID list", () => {
  const result = acceptBatch(batch([
    answer(1, { asked: ["unknown"] }),
    answer(2, { at: "2026-10-01T13:00:00.000Z" }),
    answer(3, { mode: "exam", seconds: examSeconds(DEFAULT_EXAM_LENGTH) + 1 }),
  ]))
  assert.ok(result.ok)
  if (!result.ok) return
  assert.deepEqual(result.rejected, [id(1), id(2), id(3)])
  assert.match(result.reasons[id(1)]!, /question bank/)
  assert.match(result.reasons[id(2)]!, /clock/)
  assert.match(result.reasons[id(3)]!, /duration/)
})

test("an answer's time must be real, UTC and not from the future", () => {
  const check = (at: string) => acceptAnswer(answer(1, { at }), known, now) !== null
  assert.equal(check("2026-10-01T11:59:59.000Z"), true)
  assert.equal(check("2026-10-01T13:00:00.000Z"), false)
  assert.equal(check("2026-10-01T11:00:00+02:00"), false)
  assert.equal(check("2026-02-30T11:00:00.000Z"), false)
  assert.equal(check("2024-01-01T00:00:00.000Z"), false)
})

test("storing a batch twice keeps every answer once, dated from its own time", () => {
  const first = storeAnswers([], [
    { id: id(1), at: "2026-09-30T23:50:00.000Z", mode: "round", asked: ["a"], missed: [] },
    { id: id(1), at: "2026-09-30T23:50:00.000Z", mode: "round", asked: ["a"], missed: [] },
  ])
  assert.deepEqual(first.stored, [id(1)])
  assert.deepEqual(first.duplicate, [id(1)])
  assert.deepEqual(first.lines, [{ date: "2026-09-30", session: 1, mode: "round", asked: ["a"], missed: [], id: id(1), at: "2026-09-30T23:50:00.000Z" }])
  const again = storeAnswers(first.lines, [{ id: id(1), at: "2026-09-30T23:50:00.000Z", mode: "round", asked: ["a"], missed: [] }])
  assert.deepEqual(again, { lines: [], stored: [], duplicate: [id(1)] })
})

test("answers join a session within 30 minutes of each other, and open a new one after", () => {
  const old: ScoreLine[] = [{ date: "2026-09-30", session: 4, mode: "round", asked: ["a"], missed: [] }]
  const result = storeAnswers(old, [
    { id: id(1), at: "2026-10-01T08:00:00.000Z", mode: "round", asked: ["a"], missed: [] },
    { id: id(2), at: "2026-10-01T08:20:00.000Z", mode: "exam", asked: ["a", "b"], missed: ["b"], seconds: 90 },
    { id: id(3), at: "2026-10-01T09:30:00.000Z", mode: "round", asked: ["b"], missed: [] },
  ])
  assert.deepEqual(result.lines.map((line) => line.session), [5, 5, 6])
  assert.equal(result.lines[1]?.seconds, 90)
})

test("an exam's own length decides what a finished exam may claim", () => {
  const pools = { bankIds: new Set(["a"]), termNames: new Set<string>(), courseIds: ["1"] }
  const now = Date.parse("2026-11-02T10:00:00.000Z")
  const long = answer(1, { mode: "exam", asked: ["a"], missed: [], seconds: 10_000 })
  assert.equal(acceptAnswer(long, { ...pools, examLength: { questions: 60, minutes: 90 } }, now) !== null, false, "90 minutes is that exam's limit")
  assert.equal(acceptAnswer(long, { ...pools, examLength: { questions: 80, minutes: 180 } }, now) !== null, true, "3 hours fits a 180-minute exam")
})
