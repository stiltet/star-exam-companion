import assert from "node:assert/strict"
import test from "node:test"
import { courseErrorMessage } from "./course-error.ts"

test("a public course blames Google and says to try again", () => {
  assert.match(courseErrorMessage(undefined), /^Google did not send the course text just now\. Try again in a minute\.$/)
})

test("a damaged private file says to remove that file and never blames Google", () => {
  const message = courseErrorMessage("record")
  assert.match(message, /remove it from the private-reading folder/)
  assert.doesNotMatch(message, /Google/)
})

test("a folder setting problem says to fix the setting and never to remove a saved reading", () => {
  const message = courseErrorMessage("folder")
  assert.match(message, /QUIZ_PRIVATE_DIR must be a folder outside the project/)
  assert.match(message, /saved readings are not affected/)
  assert.doesNotMatch(message, /remove it/)
  assert.doesNotMatch(message, /Google/)
})
