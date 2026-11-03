import assert from "node:assert/strict"
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import test, { after } from "node:test"
import { fileURLToPath } from "node:url"
import { postReset } from "./reset-route.ts"

// A test reads the default exam, whatever exam this machine has chosen on the Progress page.
process.env.QUIZ_EXAM_SETTING_FILE = "/nonexistent/active-exam.json"

const scratch = mkdtempSync(path.join(tmpdir(), "quiz-reset-route-"))
const before = { cwd: process.cwd(), scores: process.env.QUIZ_SCORES_FILE }
const quiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const file = path.join(scratch, "scores.jsonl")
process.chdir(quiz)
process.env.QUIZ_SCORES_FILE = file
after(() => {
  process.chdir(before.cwd)
  if (before.scores === undefined) delete process.env.QUIZ_SCORES_FILE
  else process.env.QUIZ_SCORES_FILE = before.scores
  rmSync(scratch, { recursive: true, force: true })
})

const request = (extra: Record<string, string> = {}) => new Request("http://localhost/api/scores/reset", {
  method: "POST",
  headers: { host: "localhost", origin: "http://localhost", "content-type": "application/json", ...extra },
  body: JSON.stringify({ confirm: true }),
})

test("reset-route: a page of another exam cannot empty the scores of the exam served", async () => {
  writeFileSync(file, '{"id":"kept"}\n')
  const response = await postReset(request({ "x-quiz-exam": "agentic-architect" }))
  assert.equal(response.status, 409)
  assert.deepEqual(await response.json(), { ok: false, wrongExam: "generative-ai-leader" })
  assert.equal(readFileSync(file, "utf8"), '{"id":"kept"}\n', "the scores are untouched")
  assert.equal(existsSync(path.join(scratch, "scores-backups")), false, "no backup was made")
})

test("reset-route: the exam served, and a page older than the header, reset after a backup", async () => {
  writeFileSync(file, '{"id":"kept"}\n')
  const response = await postReset(request({ "x-quiz-exam": "generative-ai-leader" }))
  assert.equal(response.status, 200)
  assert.equal(readFileSync(file, "utf8"), "")
  writeFileSync(file, '{"id":"again"}\n')
  assert.equal((await postReset(request())).status, 200)
})
