import assert from "node:assert/strict"
import test from "node:test"
import { cameFromApp, parseScroll, scrollKey } from "./scroll-memory.ts"

test("each page keeps its own scroll position", () => {
  assert.notEqual(scrollKey("/progress"), scrollKey("/exam"))
  assert.equal(scrollKey("/progress"), "quiz-scroll:/progress")
})

test("a saved scroll position is a whole number of pixels, anything else is none", () => {
  assert.equal(parseScroll("1049"), 1049)
  assert.equal(parseScroll("0"), 0)
  assert.equal(parseScroll(null), null)
  assert.equal(parseScroll(""), null)
  assert.equal(parseScroll("-5"), null)
  assert.equal(parseScroll("12.5"), null)
  assert.equal(parseScroll("abc"), null)
  assert.equal(parseScroll("99999999"), null)
})

test("a page opened from another page of the app knows it has somewhere to go back to", () => {
  const origin = "https://quiz.example.test"
  assert.equal(cameFromApp("https://quiz.example.test/progress", origin), true)
  assert.equal(cameFromApp("", origin), false)
  assert.equal(cameFromApp("https://other.example.test/progress", origin), false)
  assert.equal(cameFromApp("not a url", origin), false)
})
