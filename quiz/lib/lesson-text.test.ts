import assert from "node:assert/strict"
import test from "node:test"
import { cleanLessonText, isNoiseLine } from "./lesson-text.ts"

// Every line below is made up.

test("the skip link, step numbers, bullets and stray marks are removed", () => {
  const text = ["SKIP TO LESSON", "1", "A made-up heading for a lesson", "•", ".", ")", "A made-up sentence that stays in the reading.", "2"].join("\n")
  assert.equal(cleanLessonText(text), "A made-up heading for a lesson\nA made-up sentence that stays in the reading.")
})

test("icon names, player and quiz buttons and progress labels are removed", () => {
  for (const line of ["touch_app", "play_arrow", "arrow_forward", "add", "Click to flip", "Show Feedback", "TAKE AGAIN", "SUBMIT", "Reset", "0% COMPLETE", "(opens in a new tab)", "Proprietary + Confidential", "B"]) {
    assert.equal(isNoiseLine(line), true, line)
  }
})

test("real lines stay: headings, short words, code and sentences", () => {
  for (const line of ["Summary", "Key takeaway", "Cloud Run", "spec:", "}", "kubectl get pods", "A made-up sentence, with a comma.", "Step 1", "Pod"]) {
    assert.equal(isNoiseLine(line), false, line)
  }
  assert.equal(cleanLessonText("Alpha line\n\nBeta line"), "Alpha line\nBeta line")
})

test("the rest of a sentence after a link rejoins the line before it", () => {
  assert.equal(cleanLessonText("It uses a made-up tool\n. While it helps, it is slow.\nNext line."), "It uses a made-up tool. While it helps, it is slow.\nNext line.")
  assert.equal(cleanLessonText("See the made-up page\n, which is short.\n; and more."), "See the made-up page, which is short.; and more.")
})

test("lines that only look like a continuation stay apart", () => {
  assert.equal(cleanLessonText("Made-up intro\n.NET is a made-up name\n...and so on"), "Made-up intro\n.NET is a made-up name\n...and so on")
  assert.equal(cleanLessonText(". Starts the text"), ". Starts the text")
})
