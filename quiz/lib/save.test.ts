import assert from "node:assert/strict"
import test from "node:test"
import { postAnswers } from "./save.ts"
import type { Answer } from "./score.ts"

const reply = (status: number, body: string) => (async () => new Response(body, { status, headers: { "Content-Type": "application/json" } })) as typeof fetch
const answer: Answer = { id: "00000000-0000-4000-8000-000000000001", at: "2026-10-01T10:00:00.000Z", mode: "round", asked: ["a"], missed: ["a"] }

test("sends the batch as { answers } and returns the Mac's verdict per answer", async () => {
  const sent: unknown[] = []
  const post = (async (_url: string, init: RequestInit) => {
    sent.push(JSON.parse(String(init.body)))
    return new Response(JSON.stringify({ ok: true, stored: [answer.id], duplicate: [], rejected: [] }), { status: 200 })
  }) as typeof fetch
  assert.deepEqual(await postAnswers([answer], post), { stored: [answer.id], duplicate: [], rejected: [] })
  assert.deepEqual(sent, [{ answers: [answer] }])
})

test("a refusal, a server error, a non-JSON body or no network sends nothing", async () => {
  assert.equal(await postAnswers([answer], reply(400, '{"ok":false}')), null)
  assert.equal(await postAnswers([answer], reply(500, "<html>error</html>")), null)
  assert.equal(await postAnswers([answer], reply(200, "{}")), null)
  assert.equal(await postAnswers([answer], (async () => { throw new TypeError("offline") }) as typeof fetch), null)
  assert.deepEqual(await postAnswers([answer], reply(200, '{"ok":true,"stored":[1]}')), { stored: [], duplicate: [], rejected: [] })
})

test("refusal reasons are read when available and non-string values are ignored", async () => {
  const result = await postAnswers([answer], reply(200, JSON.stringify({
    ok: true, stored: [], duplicate: [], rejected: [answer.id],
    reasons: { [answer.id]: "Unknown question.", other: 42 },
  })))
  assert.deepEqual(result, { stored: [], duplicate: [], rejected: [answer.id], reasons: { [answer.id]: "Unknown question." } })
})
