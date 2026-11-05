import assert from "node:assert/strict"
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import test, { after } from "node:test"
import { forgetLegacyMigration, migrateLegacyScores, scoresFile } from "./load.ts"
import { DEFAULT_EXAM, migrateLegacyStorage, scoped } from "./scope.ts"

// Scratch repo roots, removed when the file's tests end.
const roots: string[] = []
after(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true })
})

function scratchRoot(): string {
  const root = mkdtempSync(path.join(tmpdir(), "scope-"))
  mkdirSync(path.join(root, "quiz"))
  roots.push(root)
  return root
}

function memory(entries: Record<string, string> = {}) {
  const data = new Map(Object.entries(entries))
  return {
    data,
    get length() { return data.size },
    key: (index: number) => [...data.keys()][index] ?? null,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  }
}

test("every item a device keeps for an exam is named after that exam", () => {
  assert.equal(scoped("quiz-outbox", "agentic-architect"), "quiz-outbox-agentic-architect")
  assert.equal(scoped("quiz-outbox", DEFAULT_EXAM), "quiz-outbox-generative-ai-leader")
})

test("the default exam takes its plain-named items over once, and another exam leaves them alone", () => {
  const entries = { "quiz-outbox": '[{"id":"a"}]', "quiz-snapshot": "{}", "quiz-practice:all": "{}", "quiz-theme": "dark", "night-place": "old place" }
  const other = memory(entries)
  migrateLegacyStorage(other, "agentic-architect")
  assert.deepEqual([...other.data.keys()].sort(), Object.keys(entries).sort())
  const store = memory(entries)
  migrateLegacyStorage(store, DEFAULT_EXAM)
  assert.deepEqual([...store.data.keys()].sort(), ["night-place-generative-ai-leader", "quiz-outbox-generative-ai-leader", "quiz-practice-generative-ai-leader:all", "quiz-snapshot-generative-ai-leader", "quiz-theme"])
  assert.equal(store.data.get("quiz-outbox-generative-ai-leader"), '[{"id":"a"}]')
  assert.equal(store.data.get("night-place-generative-ai-leader"), "old place")
  migrateLegacyStorage(store, DEFAULT_EXAM)
  assert.equal(store.data.size, 5)
})

test("a conflicting legacy Night place is kept rather than overwriting the scoped place", () => {
  const store = memory({ "night-place": "legacy", "night-place-generative-ai-leader": "new" })
  migrateLegacyStorage(store, DEFAULT_EXAM)
  assert.equal(store.data.get("night-place"), "legacy")
  assert.equal(store.data.get("night-place-generative-ai-leader"), "new")
})

test("a queue written under the plain name after the move is merged by answer id, never dropped", () => {
  const store = memory({ "quiz-outbox-generative-ai-leader": '[{"id":"a"},{"id":"b"}]', "quiz-outbox": '[{"id":"b"},{"id":"c"}]' })
  migrateLegacyStorage(store, DEFAULT_EXAM)
  assert.deepEqual(JSON.parse(store.data.get("quiz-outbox-generative-ai-leader") ?? "[]").map((item: { id: string }) => item.id), ["a", "b", "c"])
  assert.equal(store.data.has("quiz-outbox"), false)
})

test("a queue under the plain name reaches the name the app reads when the other copy is not a list", () => {
  const store = memory({ "quiz-outbox-generative-ai-leader": "not a list", "quiz-outbox": '[{"id":"c"}]' })
  migrateLegacyStorage(store, DEFAULT_EXAM)
  assert.deepEqual(JSON.parse(store.data.get(scoped("quiz-outbox", DEFAULT_EXAM)) ?? "[]").map((item: { id: string }) => item.id), ["c"])
  assert.equal(store.data.has("quiz-outbox"), false)
  assert.equal(store.data.get(`${scoped("quiz-outbox", DEFAULT_EXAM)}-unreadable`), "not a list", "the unreadable text is kept, not deleted")
})

test("an unreadable plain-named queue is kept under a backup name, not deleted", () => {
  const store = memory({ "quiz-outbox-generative-ai-leader": '[{"id":"a"}]', "quiz-outbox": "{truncated" })
  migrateLegacyStorage(store, DEFAULT_EXAM)
  assert.deepEqual(JSON.parse(store.data.get(scoped("quiz-outbox", DEFAULT_EXAM)) ?? "[]").map((item: { id: string }) => item.id), ["a"])
  assert.equal(store.data.has("quiz-outbox"), false)
  assert.equal(store.data.get(`${scoped("quiz-outbox", DEFAULT_EXAM)}-unreadable`), "{truncated")
})

test("when both copies of a queue are unreadable, both are kept, and a later unreadable copy never overwrites a kept one", () => {
  const store = memory({ "quiz-outbox-generative-ai-leader": "first {broken", "quiz-outbox": "second {broken" })
  migrateLegacyStorage(store, DEFAULT_EXAM)
  const name = scoped("quiz-outbox", DEFAULT_EXAM)
  assert.equal(store.data.get(`${name}-unreadable`), "first {broken")
  assert.equal(store.data.get(`${name}-unreadable-2`), "second {broken")
  assert.equal(store.data.get(name), "[]")
  assert.equal(store.data.has("quiz-outbox"), false)
})

test("a third different unreadable text is kept under -unreadable-3, and the same text twice is kept once", () => {
  const name = scoped("quiz-outbox", DEFAULT_EXAM)
  const store = memory({ [name]: "one {", [`${name}-unreadable`]: "one {", [`${name}-unreadable-2`]: "two {", "quiz-outbox": "three {" })
  migrateLegacyStorage(store, DEFAULT_EXAM)
  assert.equal(store.data.get(`${name}-unreadable`), "one {")
  assert.equal(store.data.get(`${name}-unreadable-2`), "two {")
  assert.equal(store.data.get(`${name}-unreadable-3`), "three {")
  assert.equal(store.data.has(`${name}-unreadable-4`), false, "the unreadable scoped text already kept is not kept twice")
})

test("an unreadable plain-named queue is kept when the scoped name holds nothing yet", () => {
  const store = memory({ "quiz-outbox": "{truncated", "quiz-rejected-reasons": "[not a map" })
  migrateLegacyStorage(store, DEFAULT_EXAM)
  assert.equal(store.data.get(`${scoped("quiz-outbox", DEFAULT_EXAM)}-unreadable`), "{truncated")
  assert.equal(store.data.get(`${scoped("quiz-rejected-reasons", DEFAULT_EXAM)}-unreadable`), "[not a map")
  assert.equal(store.data.get(scoped("quiz-outbox", DEFAULT_EXAM)), "{truncated", "the plain copy is adopted under the scoped name")
  assert.equal(store.data.has("quiz-outbox"), false)
})

test("refused reasons under the plain name reach the name the app reads when the other copy is not a map", () => {
  const store = memory({ "quiz-rejected-reasons-generative-ai-leader": "not a map", "quiz-rejected-reasons": '{"z":"gone"}' })
  migrateLegacyStorage(store, DEFAULT_EXAM)
  assert.deepEqual(JSON.parse(store.data.get(scoped("quiz-rejected-reasons", DEFAULT_EXAM)) ?? "{}"), { z: "gone" })
  assert.equal(store.data.has("quiz-rejected-reasons"), false)
  assert.equal(store.data.get(`${scoped("quiz-rejected-reasons", DEFAULT_EXAM)}-unreadable`), "not a map")
})

test("refused answers and their reasons written under the plain name after the move are merged too", () => {
  const store = memory({
    "quiz-rejected-generative-ai-leader": '[{"id":"a"}]',
    "quiz-rejected": '[{"id":"a"},{"id":"z"}]',
    "quiz-rejected-reasons-generative-ai-leader": '{"a":"new"}',
    "quiz-rejected-reasons": '{"a":"old","z":"gone"}',
  })
  migrateLegacyStorage(store, DEFAULT_EXAM)
  assert.deepEqual(JSON.parse(store.data.get("quiz-rejected-generative-ai-leader") ?? "[]").map((item: { id: string }) => item.id), ["a", "z"])
  assert.deepEqual(JSON.parse(store.data.get("quiz-rejected-reasons-generative-ai-leader") ?? "{}"), { a: "new", z: "gone" })
  assert.equal(store.data.has("quiz-rejected"), false)
  assert.equal(store.data.has("quiz-rejected-reasons"), false)
})

test("the scores file is named after the exam, and the old plain file moves once with a backup", () => {
  const env = { file: process.env.QUIZ_SCORES_FILE, exam: process.env.QUIZ_EXAM, setting: process.env.QUIZ_EXAM_SETTING_FILE }
  delete process.env.QUIZ_SCORES_FILE
  delete process.env.QUIZ_EXAM
  process.env.QUIZ_EXAM_SETTING_FILE = "/nonexistent/active-exam.json"
  forgetLegacyMigration()
  try {
    const root = scratchRoot()
    assert.equal(scoresFile(root, "agentic-architect"), path.join(root, "quiz", "scores-agentic-architect.jsonl"))
    writeFileSync(path.join(root, "quiz/scores.jsonl"), "line\n")
    migrateLegacyScores(root)
    assert.equal(existsSync(path.join(root, "quiz/scores.jsonl")), false)
    assert.equal(readFileSync(scoresFile(root, DEFAULT_EXAM), "utf8"), "line\n")
    assert.equal(readFileSync(path.join(root, "quiz/scores-backups/scores-generative-ai-leader-before-exam-names.jsonl"), "utf8"), "line\n")
    // Once per start: a plain file an older build writes afterwards is merged at the next start (below).
    writeFileSync(path.join(root, "quiz/scores.jsonl"), "newer\n")
    migrateLegacyScores(root)
    assert.equal(readFileSync(scoresFile(root, DEFAULT_EXAM), "utf8"), "line\n")
  } finally {
    for (const [key, value] of [["QUIZ_SCORES_FILE", env.file], ["QUIZ_EXAM", env.exam], ["QUIZ_EXAM_SETTING_FILE", env.setting]] as const) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
})

test("a second move after a rollback keeps the first backup instead of overwriting it", () => {
  const env = { file: process.env.QUIZ_SCORES_FILE, exam: process.env.QUIZ_EXAM, setting: process.env.QUIZ_EXAM_SETTING_FILE }
  delete process.env.QUIZ_SCORES_FILE
  delete process.env.QUIZ_EXAM
  process.env.QUIZ_EXAM_SETTING_FILE = "/nonexistent/active-exam.json"
  forgetLegacyMigration()
  try {
    const root = scratchRoot()
    const backups = path.join(root, "quiz/scores-backups")
    writeFileSync(path.join(root, "quiz/scores.jsonl"), "first\n")
    migrateLegacyScores(root)
    // A rollback: the exam's own file is deleted by hand and an older build writes a plain file again.
    unlinkSync(scoresFile(root, DEFAULT_EXAM))
    writeFileSync(path.join(root, "quiz/scores.jsonl"), "second\n")
    forgetLegacyMigration()
    migrateLegacyScores(root)
    assert.equal(readFileSync(path.join(backups, "scores-generative-ai-leader-before-exam-names.jsonl"), "utf8"), "first\n")
    const later = readdirSync(backups).filter((name) => /^scores-generative-ai-leader-before-exam-names-\d+\.jsonl$/.test(name))
    assert.equal(later.length, 1)
    assert.equal(readFileSync(path.join(backups, later[0]), "utf8"), "second\n")
  } finally {
    for (const [key, value] of [["QUIZ_SCORES_FILE", env.file], ["QUIZ_EXAM", env.exam], ["QUIZ_EXAM_SETTING_FILE", env.setting]] as const) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
})

test("a plain scores file an older build wrote after the move is merged by answer id at the next start", () => {
  const env = { file: process.env.QUIZ_SCORES_FILE, exam: process.env.QUIZ_EXAM, setting: process.env.QUIZ_EXAM_SETTING_FILE }
  delete process.env.QUIZ_SCORES_FILE
  delete process.env.QUIZ_EXAM
  process.env.QUIZ_EXAM_SETTING_FILE = "/nonexistent/active-exam.json"
  const line = (id: string) => `{"date":"2026-10-02","session":1,"mode":"round","asked":["a"],"missed":[],"id":"${id}"}`
  try {
    const root = scratchRoot()
    writeFileSync(scoresFile(root, DEFAULT_EXAM), `${line("one")}\n`)
    writeFileSync(path.join(root, "quiz/scores.jsonl"), `${line("one")}\n${line("two")}\n`)
    forgetLegacyMigration()
    migrateLegacyScores(root)
    assert.equal(existsSync(path.join(root, "quiz/scores.jsonl")), false, "the plain file is moved away")
    assert.equal(readFileSync(scoresFile(root, DEFAULT_EXAM), "utf8"), `${line("one")}\n${line("two")}\n`, "its new answer joined the exam's file once")
  } finally {
    for (const [key, value] of [["QUIZ_SCORES_FILE", env.file], ["QUIZ_EXAM", env.exam], ["QUIZ_EXAM_SETTING_FILE", env.setting]] as const) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
})

test("another exam running first does not spend the one-time migration", () => {
  const env = { file: process.env.QUIZ_SCORES_FILE, exam: process.env.QUIZ_EXAM, setting: process.env.QUIZ_EXAM_SETTING_FILE }
  delete process.env.QUIZ_SCORES_FILE
  process.env.QUIZ_EXAM_SETTING_FILE = "/nonexistent/active-exam.json"
  forgetLegacyMigration()
  try {
    const root = scratchRoot()
    writeFileSync(path.join(root, "quiz/scores.jsonl"), "history\n")
    process.env.QUIZ_EXAM = "agentic-architect"
    migrateLegacyScores(root)
    assert.equal(existsSync(path.join(root, "quiz/scores.jsonl")), true, "another exam never touches the old file")
    delete process.env.QUIZ_EXAM
    migrateLegacyScores(root)
    assert.equal(readFileSync(scoresFile(root, DEFAULT_EXAM), "utf8"), "history\n", "the default exam, later in the same process, still migrates")
  } finally {
    for (const [key, value] of [["QUIZ_SCORES_FILE", env.file], ["QUIZ_EXAM", env.exam], ["QUIZ_EXAM_SETTING_FILE", env.setting]] as const) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
})
