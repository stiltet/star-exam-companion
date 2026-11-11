import assert from "node:assert/strict"
import test from "node:test"
import { cameFromApp, entryKey, parseEntry, serialiseEntry } from "./scroll-memory.ts"

test("each history entry keeps its own record, whatever its path", () => {
  assert.notEqual(entryKey("a"), entryKey("b"))
  assert.equal(entryKey("a"), "quiz-entry:a")
})

test("an entry remembers the entry before it and its scroll, and survives being stored", () => {
  assert.deepEqual(parseEntry(serialiseEntry({ prev: "p1", scroll: 1049 })), { prev: "p1", scroll: 1049 })
  assert.deepEqual(parseEntry(serialiseEntry({ prev: null, scroll: 0 })), { prev: null, scroll: 0 })
})

test("anything that is not a whole, non-negative scroll and a previous entry or none is no entry", () => {
  assert.equal(parseEntry(null), null)
  assert.equal(parseEntry(""), null)
  assert.equal(parseEntry("not json"), null)
  assert.equal(parseEntry("12"), null)
  assert.equal(parseEntry(JSON.stringify({ prev: 3, scroll: 1 })), null)
  assert.equal(parseEntry(JSON.stringify({ prev: null, scroll: -5 })), null)
  assert.equal(parseEntry(JSON.stringify({ prev: null, scroll: 12.5 })), null)
  assert.equal(parseEntry(JSON.stringify({ prev: null, scroll: 99999999 })), null)
  assert.equal(parseEntry(JSON.stringify({ prev: null })), null)
})

test("a page opened from another page of the app knows it has somewhere to go back to", () => {
  const origin = "https://quiz.example.test"
  assert.equal(cameFromApp("https://quiz.example.test/progress", origin), true)
  assert.equal(cameFromApp("", origin), false)
  assert.equal(cameFromApp("https://other.example.test/progress", origin), false)
  assert.equal(cameFromApp("not a url", origin), false)
})
