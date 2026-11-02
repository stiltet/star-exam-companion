import assert from "node:assert/strict"
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, existsSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import test from "node:test"
import { migrateLegacyScores, scoresFile } from "./load.ts"
import { DEFAULT_EXAM, migrateLegacyStorage, scoped } from "./scope.ts"

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
  const entries = { "quiz-outbox": '[{"id":"a"}]', "quiz-snapshot": "{}", "quiz-practice:all": "{}", "quiz-theme": "dark" }
  const other = memory(entries)
  migrateLegacyStorage(other, "agentic-architect")
  assert.deepEqual([...other.data.keys()].sort(), Object.keys(entries).sort())
  const store = memory(entries)
  migrateLegacyStorage(store, DEFAULT_EXAM)
  assert.deepEqual([...store.data.keys()].sort(), ["quiz-outbox-generative-ai-leader", "quiz-practice-generative-ai-leader:all", "quiz-snapshot-generative-ai-leader", "quiz-theme"])
  assert.equal(store.data.get("quiz-outbox-generative-ai-leader"), '[{"id":"a"}]')
  migrateLegacyStorage(store, DEFAULT_EXAM)
  assert.equal(store.data.size, 4)
})

test("a queue written under the plain name after the move is merged by answer id, never dropped", () => {
  const store = memory({ "quiz-outbox-generative-ai-leader": '[{"id":"a"},{"id":"b"}]', "quiz-outbox": '[{"id":"b"},{"id":"c"}]' })
  migrateLegacyStorage(store, DEFAULT_EXAM)
  assert.deepEqual(JSON.parse(store.data.get("quiz-outbox-generative-ai-leader") ?? "[]").map((item: { id: string }) => item.id), ["a", "b", "c"])
  assert.equal(store.data.has("quiz-outbox"), false)
})

test("the scores file is named after the exam, and the old plain file moves once with a backup", () => {
  const before = process.env.QUIZ_SCORES_FILE
  delete process.env.QUIZ_SCORES_FILE
  try {
    const root = mkdtempSync(path.join(tmpdir(), "scope-"))
    mkdirSync(path.join(root, "quiz"))
    assert.equal(scoresFile(root, "agentic-architect"), path.join(root, "quiz", "scores-agentic-architect.jsonl"))
    writeFileSync(path.join(root, "quiz/scores.jsonl"), "line\n")
    migrateLegacyScores(root)
    assert.equal(existsSync(path.join(root, "quiz/scores.jsonl")), false)
    assert.equal(readFileSync(scoresFile(root, DEFAULT_EXAM), "utf8"), "line\n")
    assert.equal(readFileSync(path.join(root, "quiz/scores-backups/scores-generative-ai-leader-before-exam-names.jsonl"), "utf8"), "line\n")
  } finally {
    if (before !== undefined) process.env.QUIZ_SCORES_FILE = before
  }
})
