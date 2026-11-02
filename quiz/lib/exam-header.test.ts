import assert from "node:assert/strict"
import test from "node:test"
import { EXAM_HEADER, examHeaders, followWrongExam } from "./exam-header.ts"

test("exam-header: a request names the page's exam", () => {
  // Outside a browser a page has no exam of its own, so it is the default exam's.
  assert.deepEqual(examHeaders(), { [EXAM_HEADER]: "generative-ai-leader" })
})

test("exam-header: only a 409 that names the exam served is a wrong-exam refusal", async () => {
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })
  assert.equal(await followWrongExam(json(409, { ok: false, wrongExam: "agentic-architect" })), true)
  assert.equal(await followWrongExam(json(409, { ok: false, row: "Broken", error: "bad row" })), false, "a glossary 409 is the caller's")
  assert.equal(await followWrongExam(json(200, { ok: true })), false)
  assert.equal(await followWrongExam(new Response("not json", { status: 409 })), false)
})
