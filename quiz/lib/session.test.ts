import assert from "node:assert/strict"
import test from "node:test"
import { IDLE_MS, type ScoreLine } from "./learn.ts"
import { currentSession } from "./session.ts"

const lines: ScoreLine[] = [{ date: "2026-09-30", session: 4, mode: "round", asked: ["a"], missed: [] }]

// One test, in order: the module keeps the session between calls, as the server does.
test("a server start opens a new session, answers keep it, and a long break opens the next", () => {
  const t0 = 1_000_000_000
  assert.equal(currentSession(lines, t0), 5, "first call after start is above every saved session")
  assert.equal(currentSession(lines, t0 + 60_000), 5, "an answer a minute later stays in it")
  const saved = [...lines, { ...lines[0], session: 5 }]
  assert.equal(currentSession(saved, t0 + 60_000 + IDLE_MS - 1), 5, "just under the idle limit stays")
  assert.equal(currentSession(saved, t0 + 60_000 + 2 * IDLE_MS), 6, "past the idle limit opens the next")
})
