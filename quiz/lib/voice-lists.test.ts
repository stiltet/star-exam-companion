import assert from "node:assert/strict"
import test from "node:test"
import { voiceCleanup } from "./voice-lists.ts"

test("voice-lists: switching exams keeps clips another exam still uses and deletes only what this exam stored", () => {
  const lists = { a: ["/api/speak/1", "/api/speak/2", "/api/speak/3"], b: ["/api/speak/3"] }
  // Exam a now wants clip 1 and a new clip 4: clip 2 was only a's, clip 3 is still b's.
  const result = voiceCleanup(["/api/speak/1", "/api/speak/2", "/api/speak/3"], lists, "a", ["/api/speak/1", "/api/speak/4"])
  assert.deepEqual(result.remove, ["/api/speak/2"])
  assert.deepEqual(result.lists, { a: ["/api/speak/1", "/api/speak/4"], b: ["/api/speak/3"] })
})

test("voice-lists: a clip stored before the lists existed is never deleted", () => {
  const result = voiceCleanup(["/api/speak/old", "/api/speak/1"], {}, "a", ["/api/speak/1"])
  assert.deepEqual(result.remove, [])
  assert.deepEqual(result.lists, { a: ["/api/speak/1"] })
})

test("voice-lists: an exam with no list yet deletes nothing, whatever the others stored", () => {
  const result = voiceCleanup(["/api/speak/9"], { a: ["/api/speak/9"] }, "b", ["/api/speak/1"])
  assert.deepEqual(result.remove, [])
})
