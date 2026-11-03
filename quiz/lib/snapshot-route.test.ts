import assert from "node:assert/strict"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import test, { after } from "node:test"
import { fileURLToPath } from "node:url"
import { getSnapshot } from "./snapshot-route.ts"

// A test reads the default exam, whatever exam this machine has chosen on the Progress page.
process.env.QUIZ_EXAM_SETTING_FILE = "/nonexistent/active-exam.json"

const scratch = mkdtempSync(path.join(tmpdir(), "quiz-snapshot-route-"))
const before = { cwd: process.cwd(), scores: process.env.QUIZ_SCORES_FILE }
const quiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
process.chdir(quiz)
process.env.QUIZ_SCORES_FILE = path.join(scratch, "scores.jsonl")
after(() => {
  process.chdir(before.cwd)
  if (before.scores === undefined) delete process.env.QUIZ_SCORES_FILE
  else process.env.QUIZ_SCORES_FILE = before.scores
  rmSync(scratch, { recursive: true, force: true })
})

const request = (extra: Record<string, string> = {}) => new Request("http://localhost/api/snapshot", { headers: { host: "localhost", ...extra } })

test("snapshot-route: a page of another exam is refused with the exam served, and gets no snapshot", async () => {
  const response = await getSnapshot(request({ "x-quiz-exam": "agentic-architect" }))
  assert.equal(response.status, 409)
  assert.deepEqual(await response.json(), { ok: false, wrongExam: "generative-ai-leader" })
})

test("snapshot-route: the exam served, and a page older than the header, get the snapshot", async () => {
  for (const extra of [{ "x-quiz-exam": "generative-ai-leader" }, {}] as Record<string, string>[]) {
    const response = await getSnapshot(request(extra))
    assert.equal(response.status, 200)
    const body = (await response.json()) as { ok: boolean; snapshot: { items: unknown[] } }
    assert.equal(body.ok, true)
    assert.ok(body.snapshot.items.length > 0)
  }
})
