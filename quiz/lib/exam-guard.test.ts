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

test("exam-guard: the same exam, and a page older than the header, pass", () => {
  assert.equal(wrongExam(request({ "x-quiz-exam": "generative-ai-leader" }), "generative-ai-leader"), null)
  assert.equal(wrongExam(request(), "generative-ai-leader"), null)
})

test("exam-guard: a caller can limit an older headerless page to its original exam", async () => {
  const legacy = "generative-ai-leader"
  assert.equal(wrongExam(request(), legacy, legacy), null)
  const refused = wrongExam(request(), "agentic-architect", legacy)
  assert.equal(refused?.status, 409)
  assert.deepEqual(await refused?.json(), { ok: false, wrongExam: "agentic-architect" })
  assert.equal(wrongExam(request({ "x-quiz-exam": "agentic-architect" }), "agentic-architect", legacy), null)
})
