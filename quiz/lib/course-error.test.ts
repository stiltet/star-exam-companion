import assert from "node:assert/strict"
import test from "node:test"
import { courseErrorMessage } from "./course-error.ts"

test("a public course blames Google and says to try again", () => {
  assert.match(courseErrorMessage("HTTP 503", false), /^Google did not send the course text just now\. Try again in a minute\.$/)
})

test("a damaged private file says to remove that file", () => {
  for (const detail of ["Private reading record abc.json is not valid JSON.", "Private reading record abc.json is invalid.", "Private reading record abc.json is too large."]) {
    const message = courseErrorMessage(detail, true)
    assert.match(message, /remove it from the private-reading folder/, detail)
    assert.doesNotMatch(message, /Google/, detail)
  }
})

test("a folder setting problem says to fix the setting and never to remove a saved reading", () => {
  for (const detail of ["QUIZ_PRIVATE_DIR must be an absolute path.", "Private readings must be stored outside the repository."]) {
    const message = courseErrorMessage(detail, true)
    assert.match(message, /QUIZ_PRIVATE_DIR must be a folder outside the project/, detail)
    assert.doesNotMatch(message, /remove it/, detail)
    assert.doesNotMatch(message, /Google/, detail)
  }
})
