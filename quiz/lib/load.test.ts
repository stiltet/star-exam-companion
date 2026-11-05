import assert from "node:assert/strict"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
import { loadPlay, loadVoiceIndex, readScores, scoresFile } from "./load.ts"
import { speechKey, voiceKeys } from "./speak.ts"

// A test reads the default exam, whatever exam this machine has chosen on the Progress page.
process.env.QUIZ_EXAM_SETTING_FILE = "/nonexistent/active-exam.json"

// loadPlay reads the repo from the quiz directory, as the running app does.
test("loads the glossary, the section weights and the scores from the repo", () => {
  const quizDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
  const before = process.cwd()
  process.chdir(quizDir)
  try {
    const play = loadPlay()
    assert.equal(play.ok, true)
    if (!play.ok) return
    assert.ok(play.items.length > 0, "the glossary yields questions")
    assert.equal(Object.keys(play.weights).length, 4, "four exam sections are weighted")
    assert.equal(play.root, path.resolve(quizDir, ".."))
    assert.ok(play.skippedLines >= 0)
  } finally {
    process.chdir(before)
  }
})

test("QUIZ_SCORES_FILE moves the scores to a scratch file, so a test instance never writes real ones", () => {
  const before = process.env.QUIZ_SCORES_FILE
  try {
    delete process.env.QUIZ_SCORES_FILE
    assert.equal(scoresFile("/repo"), path.join("/repo", "quiz/scores-generative-ai-leader.jsonl"))
    process.env.QUIZ_SCORES_FILE = "/tmp/scratch/scores.jsonl"
    assert.equal(scoresFile("/repo"), "/tmp/scratch/scores.jsonl")
    assert.deepEqual(readScores("/nonexistent/scores.jsonl"), { lines: [], skipped: 0 })
  } finally {
    if (before === undefined) delete process.env.QUIZ_SCORES_FILE
    else process.env.QUIZ_SCORES_FILE = before
  }
})

test("the voice index is built once per glossary and knows exactly the quiz's own lines", () => {
  const quizDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
  const before = process.cwd()
  process.chdir(quizDir)
  try {
    const first = loadVoiceIndex()
    assert.ok(first, "the glossary parses")
    assert.equal(loadVoiceIndex(), first, "an unchanged glossary reuses the index")
    const play = loadPlay()
    if (!play.ok) throw new Error("glossary does not parse")
    for (const key of Object.values(voiceKeys(play.items))) assert.ok(first.has(key), key)
    assert.equal(first.get(speechKey("Say anything I like.")), undefined, "a key the quiz never wrote is unknown")
  } finally {
    process.chdir(before)
  }
})
