import assert from "node:assert/strict"
import test from "node:test"
import { wrongExam } from "./exam-guard.ts"

const request = (headers: Record<string, string> = {}) => new Request("http://localhost/api/scores", { method: "POST", headers })

test("exam-guard: a request from a page of another exam is refused with 409 and the exam served", async () => {
  const response = wrongExam(request({ "x-quiz-exam": "agentic-architect" }), "generative-ai-leader")
  assert.equal(response?.status, 409)
  assert.deepEqual(await response?.json(), { ok: false, wrongExam: "generative-ai-leader" })
  assert.equal(response?.headers.get("cache-control"), "no-store")
})

test("exam-guard: a page of the exam served passes", () => {
  assert.equal(wrongExam(request({ "x-quiz-exam": "generative-ai-leader" }), "generative-ai-leader"), null)
  assert.equal(wrongExam(request({ "x-quiz-exam": "agentic-architect" }), "agentic-architect"), null)
})

test("exam-guard: a page older than the header belongs to the default exam, so it passes only while that exam is served", async () => {
  assert.equal(wrongExam(request(), "generative-ai-leader"), null)
  const refused = wrongExam(request(), "agentic-architect")
  assert.equal(refused?.status, 409)
  assert.deepEqual(await refused?.json(), { ok: false, wrongExam: "agentic-architect" })
})
