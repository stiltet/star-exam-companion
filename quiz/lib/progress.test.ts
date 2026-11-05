import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import type { ScoreLine } from "./learn.ts"
import { answeredIds, courseLabel, sectionLabel, examHistory, flashcardProgress, modeLines, practiceProgress, progressFigures, needsSaving, readingProgress, readingState, readingStatus, readToday, sectionJump, sectionPosition, shuffleOptions, voiceRound } from "./progress.ts"
import { itemsFromGlossary } from "./round.ts"
import { absorbSent, isSnapshot, readSnapshot, SNAPSHOT_KEY, writeSnapshot, type Snapshot } from "./snapshot.ts"
import { parseGlossary } from "./sources.ts"
import { testBank, testPack } from "./test-pack.ts"

const parsed = parseGlossary(testPack.glossaryText)
if (!parsed.ok) throw new Error(`glossary row ${parsed.row}: ${parsed.error}`)
const items = itemsFromGlossary(parsed.glossary, testPack.scenes)
const first = items[0]?.id ?? ""
const sections = [{ id: 1, title: "fundamentals", weight: 30 }]
const line = (mode: string, asked: string[], missed: string[] = [], extra: Partial<ScoreLine> = {}): ScoreLine => ({ date: "2026-10-01", session: 1, mode, asked, missed, ...extra })

test("practice, exams and flashcards never change a Voice Quiz round", () => {
  const lines = [line("practice", [first]), line("exam", items.map((item) => item.id), [], { seconds: 60 }), line("flashcard", ["Grounding"])]
  assert.equal(voiceRound(items, lines).length, items.length)
  assert.equal(voiceRound(items, [...lines, line("round", [first])]).length, items.length - 1)
  assert.deepEqual(modeLines(lines, "exam").length, 1)
})

test("readings read are counted per course, each once, with the last day read", () => {
  const lines = [
    line("reading", ["2/aaaaaaaaaaaaaaaaaaaaaaaa"], [], { date: "2026-10-19" }),
    line("reading", ["2/aaaaaaaaaaaaaaaaaaaaaaaa"], [], { date: "2026-10-20" }),
    line("reading", ["2/bbbbbbbbbbbbbbbbbbbbbbbb"], [], { date: "2026-10-20" }),
    line("reading", ["3/cccccccccccccccccccccccc"], [], { date: "2026-10-18" }),
    line("round", [first]),
  ]
  assert.deepEqual(readingProgress(lines), {
    "2": { read: ["aaaaaaaaaaaaaaaaaaaaaaaa", "bbbbbbbbbbbbbbbbbbbbbbbb"], last: "2026-10-20" },
    "3": { read: ["cccccccccccccccccccccccc"], last: "2026-10-18" },
  })
  assert.equal(voiceRound(items, lines).length, items.length - 1, "readings never change a Voice Quiz round")
})

test("a course shows as done, in progress or not started", () => {
  assert.equal(readingStatus(0, 12), "Not started · 0 of 12")
  assert.equal(readingStatus(0, undefined), "Not started")
  assert.equal(readingStatus(0, 0), "Not started", "no readings means there is no total to show")
  assert.equal(readingStatus(4, 13), "In progress · 4 of 13")
  assert.equal(readingStatus(4, undefined), "In progress · 4 read")
  assert.equal(readingStatus(12, 12), "✓ Done · 12 of 12")
  assert.equal(readingStatus(13, 12), "✓ Done · 12 of 12", "a reading Google dropped never makes 13 of 12")
  assert.deepEqual([readingState(0, 12), readingState(4, 13), readingState(4, undefined), readingState(12, 12)], ["none", "progress", "progress", "done"])
})

test("a reading is saved once a day: a second tap does not save, a failed save or a new day does", () => {
  const id = "2/bbbbbbbbbbbbbbbbbbbbbbbb"
  assert.equal(needsSaving([], id, "2026-10-20", null), true, "first time")
  assert.equal(needsSaving([], id, "2026-10-20", "2026-10-20"), false, "tapped again before the line arrived")
  assert.equal(needsSaving([line("reading", [id], [], { date: "2026-10-20" })], id, "2026-10-20", null), false, "already saved today")
  assert.equal(needsSaving([], id, "2026-10-20", null), true, "the save failed, so savedOn stayed unset")
  assert.equal(needsSaving([line("reading", [id], [], { date: "2026-10-20" })], id, "2026-10-21", "2026-10-20"), true, "a new day")
})

test("hand-edited reading lines that are not a course and page are ignored", () => {
  const odd = line("reading", ["2/", "x", "/abc"], [], { date: "2026-10-20" })
  const notText = { ...odd, asked: [5 as unknown as string] }
  assert.deepEqual(readingProgress([odd, notText]), {})
  assert.equal(readingStatus(1, 0), "In progress · 1 read", "a course with no readings is never done")
  assert.equal(readingState(1, 0), "progress")
})

test("a reading counts as read today only for that page on that day", () => {
  const lines = [line("reading", ["2/bbbbbbbbbbbbbbbbbbbbbbbb"], [], { date: "2026-10-20" })]
  assert.equal(readToday(lines, "2/bbbbbbbbbbbbbbbbbbbbbbbb", "2026-10-20"), true)
  assert.equal(readToday(lines, "2/bbbbbbbbbbbbbbbbbbbbbbbb", "2026-10-21"), false)
  assert.equal(readToday(lines, "2/aaaaaaaaaaaaaaaaaaaaaaaa", "2026-10-20"), false)
  assert.equal(readToday([line("practice", ["2/bbbbbbbbbbbbbbbbbbbbbbbb"])], "2/bbbbbbbbbbbbbbbbbbbbbbbb", "2026-10-01"), false)
})

test("practice progress counts practice answers only, latest answer per question", () => {
  const lines = [line("round", [first]), line("practice", [first], [first]), line("practice", [first])]
  const progress = practiceProgress(items, lines, sections)
  assert.equal(progress.asked, 1)
  assert.equal(progress.correct, 1)
})

test("exam history lists each finished exam, newest first, with its score and time", () => {
  const lines = [line("exam", ["a", "b"], ["b"], { date: "2026-09-30", seconds: 3000 }), line("exam", ["a", "b", "c", "d"], [], { seconds: 4000 })]
  assert.deepEqual(examHistory(lines), [
    { date: "2026-10-01", total: 4, correct: 4, percent: 100, seconds: 4000, asked: ["a", "b", "c", "d"], missed: [] },
    { date: "2026-09-30", total: 2, correct: 1, percent: 50, seconds: 3000, asked: ["a", "b"], missed: ["b"] },
  ])
})

test("a retake is not a practice exam, but is listed apart for review", () => {
  const lines = [line("exam", ["a", "b"], ["b"], { seconds: 60, id: "full" }), line("exam", ["b"], [], { seconds: 30, id: "again", retake: true })]
  assert.deepEqual(examHistory(lines).map((exam) => exam.id), ["full"])
  assert.deepEqual(examHistory(lines, "retake").map((exam) => [exam.id, exam.retake]), [["again", true]])
  assert.deepEqual(examHistory(lines, "all").map((exam) => exam.id), ["again", "full"])
})

test("an exam saved with its answers and flags can be found and reviewed", () => {
  const [exam] = examHistory([line("exam", ["a", "b"], ["b"], { seconds: 60, id: "x", answers: { a: 0 }, flagged: ["b"] })])
  assert.deepEqual([exam?.id, exam?.answers, exam?.flagged], ["x", { a: 0 }, ["b"]])
})

test("an exam with no question answered is left out of every list", () => {
  const lines = [
    line("exam", ["a", "b"], ["a", "b"], { id: "empty", answers: {} }),
    line("exam", ["a", "b"], ["a", "b"], { id: "old-empty" }),
    line("exam", ["a", "b"], ["a", "b"], { id: "tried", answers: { a: 1 } }),
    line("exam", ["a", "b"], ["b"], { id: "old-one-right" }),
  ]
  assert.deepEqual(examHistory(lines, "all").map((exam) => exam.id), ["old-one-right", "tried"])
})

test("a question counts as answered once any mode has an answer for it", () => {
  const lines = [
    line("practice", ["p"], ["p"]),
    line("round", ["r"]),
    line("exam", ["e1", "e2", "e3"], ["e2", "e3"], { answers: { e1: 0, e2: 1 } }),
    line("exam", ["o1", "o2"], ["o2"]),
    line("reading", ["2/bbbbbbbbbbbbbbbbbbbbbbbb"]),
  ]
  assert.deepEqual([...answeredIds(lines)].sort(), ["e1", "e2", "o1", "p", "r"])
})

test("a flashcard is known by its latest mark", () => {
  const lines = [line("flashcard", ["Gems"]), line("flashcard", ["Gems"], ["Gems"]), line("flashcard", ["Grounding"])]
  assert.deepEqual(flashcardProgress(["Gems", "Grounding", "Agent"], lines), { total: 3, marked: 2, known: 1 })
})

function memory() {
  const data = new Map<string, string>()
  return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => void data.set(key, value) }
}

test("the device keeps the Mac's snapshot, and answers the Mac has taken join it", () => {
  const snapshot: Snapshot = { items, terms: ["Gems"], namesChecked: "2026-10-01", sections, lines: [], skippedLines: 0, voice: {} }
  const store = memory()
  writeSnapshot(store, snapshot)
  assert.deepEqual(readSnapshot(store), snapshot)
  store.setItem(SNAPSHOT_KEY, '{"items":"no"}')
  assert.equal(readSnapshot(store), null)
  assert.equal(isSnapshot(null), false)
  const sent = absorbSent(snapshot, [{ id: "00000000-0000-4000-8000-000000000001", at: "2026-10-01T09:00:00.000Z", mode: "round", asked: [first], missed: [] }])
  assert.deepEqual(sent.lines.map((saved) => saved.asked[0]), [first])
})

test("the progress figures are counted against all questions, so the gap is to the whole quiz", () => {
  const figures = progressFigures({ total: 204, asked: 62, correct: 52 })
  assert.deepEqual(figures, {
    total: 204,
    answered: 62,
    answeredPercent: 30,
    correctOfAnswered: 84,
    correctOfAll: 25,
    gap: 75,
  })
  assert.deepEqual(progressFigures({ total: 0, asked: 0, correct: 0 }), { total: 0, answered: 0, answeredPercent: 0, correctOfAnswered: 0, correctOfAll: 0, gap: 100 })
})

test("a Voice Quiz round goes exam section by exam section, 1 to 4, shuffled inside each section", () => {
  const round = voiceRound(items, [])
  const order = round.map((item) => item.section)
  assert.deepEqual(order, [...order].sort((a, b) => a - b))
  assert.deepEqual([...new Set(order)], [1, 2, 3, 4])
  let seed = 1
  const other = voiceRound(items, [], () => ((seed = (seed * 16807) % 2147483647) / 2147483647))
  const firstSection = (list: typeof round) => list.filter((item) => item.section === 1).map((item) => item.id)
  assert.notDeepEqual(firstSection(round), firstSection(other))
  assert.deepEqual([...firstSection(round)].sort(), [...firstSection(other)].sort())
})

test("the title counts questions inside the current exam section and in the whole round", () => {
  const round = [{ section: 1 }, { section: 1 }, { section: 1 }, { section: 2 }, { section: 2 }]
  assert.deepEqual(sectionPosition(round, 1), { section: 1, number: 2, count: 3 })
  assert.deepEqual(sectionPosition(round, 3), { section: 2, number: 1, count: 2 })
  assert.equal(sectionPosition(round, 9), null)
  assert.equal(sectionPosition([{}], 0), null)
})

test("section jumps land on the first question of the neighbouring exam section", () => {
  const round = [{ section: 1 }, { section: 1 }, { section: 1 }, { section: 2 }, { section: 2 }, { section: 4 }]
  assert.equal(courseLabel(1), "Course 1")
  assert.equal(sectionLabel(1, 30), "Section 1 (~30%)")
  assert.deepEqual(sectionJump(round, 1), { previous: null, next: 3 })
  assert.deepEqual(sectionJump(round, 3), { previous: 0, next: 5 })
  assert.deepEqual(sectionJump(round, 5), { previous: 3, next: null })
  assert.deepEqual(sectionJump(round, 9), { previous: null, next: null })
  assert.deepEqual(sectionJump([{}], 0), { previous: null, next: null })
})

test("shuffleOptions reorders the options and keeps the right answer marked", () => {
  const item = { ...items[0]!, options: ["one", "two", "three", "four"], correctIndex: 2 }
  const orders = new Set<string>()
  for (let step = 0; step < 40; step += 1) {
    let seed = step + 1
    const shuffled = shuffleOptions(item, () => ((seed = (seed * 16807) % 2147483647) / 2147483647))
    assert.deepEqual([...shuffled.options].sort(), ["four", "one", "three", "two"])
    assert.equal(shuffled.options[shuffled.correctIndex], "three")
    orders.add(shuffled.options.join())
  }
  assert.ok(orders.size > 1)
})

test("voiceRound shuffles each question's options and keeps the right answer marked", () => {
  let seed = 7
  const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  const round = voiceRound(items, [], random)
  const original = new Map(items.map((item) => [item.id, item]))
  let moved = 0
  for (const item of round) {
    const before = original.get(item.id)!
    assert.deepEqual([...item.options].sort(), [...before.options].sort())
    assert.equal(item.options[item.correctIndex], before.options[before.correctIndex])
    if (item.options.join() !== before.options.join()) moved += 1
  }
  assert.ok(moved > round.length / 2)
})
