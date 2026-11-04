import assert from "node:assert/strict"
import { mkdtempSync, readFileSync, rmSync, existsSync, mkdirSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import test, { after } from "node:test"
import { examLogFile, recordExamSwitch } from "./exam-audit.ts"

const scratch = mkdtempSync(path.join(tmpdir(), "quiz-exam-audit-"))
const before = process.env.QUIZ_EXAM_SETTING_FILE
process.env.QUIZ_EXAM_SETTING_FILE = path.join(scratch, "active-exam.json")
after(() => {
  if (before === undefined) delete process.env.QUIZ_EXAM_SETTING_FILE
  else process.env.QUIZ_EXAM_SETTING_FILE = before
  rmSync(scratch, { recursive: true, force: true })
})

const at = (iso: string) => () => new Date(iso)

test("the log sits next to the file that holds the chosen exam", () => {
  assert.equal(examLogFile(), path.join(scratch, "exam-switches.log"))
})

test("a switch appends one line with the time, the exam left and the exam chosen", () => {
  recordExamSwitch("generative-ai-leader", "agentic-architect", undefined, at("2026-11-04T09:12:03.000Z"))
  recordExamSwitch("agentic-architect", "generative-ai-leader", undefined, at("2026-11-04T10:00:00.000Z"))
  assert.equal(
    readFileSync(examLogFile(), "utf8"),
    "2026-11-04T09:12:03.000Z switched from generative-ai-leader to agentic-architect\n" +
      "2026-11-04T10:00:00.000Z switched from agentic-architect to generative-ai-leader\n",
  )
})

test("a switch to the exam already served leaves no line", () => {
  const lines = readFileSync(examLogFile(), "utf8").split("\n").length
  recordExamSwitch("agentic-architect", "agentic-architect")
  assert.equal(readFileSync(examLogFile(), "utf8").split("\n").length, lines)
})

test("a log that cannot be written is reported and never throws", (t) => {
  const blocked = path.join(scratch, "blocked")
  mkdirSync(path.join(blocked, "exam-switches.log"), { recursive: true })
  const saved = process.env.QUIZ_EXAM_SETTING_FILE
  const errors = t.mock.method(console, "error", () => undefined)
  process.env.QUIZ_EXAM_SETTING_FILE = path.join(blocked, "active-exam.json")
  try {
    assert.doesNotThrow(() => recordExamSwitch("a", "b"))
    assert.equal(existsSync(path.join(blocked, "exam-switches.log")), true, "the folder in the way is untouched")
    assert.equal(errors.mock.callCount(), 1)
    assert.equal(errors.mock.calls[0]?.arguments[0], "Could not write the exam switch audit log:")
    assert.ok(errors.mock.calls[0]?.arguments[1] instanceof Error)
  } finally {
    process.env.QUIZ_EXAM_SETTING_FILE = saved
  }
})
