import assert from "node:assert/strict"
import test from "node:test"
import { parentPath } from "./parent-path.ts"

test("Back with no history goes one level up, and home has nowhere to go", () => {
  assert.equal(parentPath("/study/fundamentals/introduction"), "/study/fundamentals")
  assert.equal(parentPath("/study/fundamentals"), "/study")
  assert.equal(parentPath("/read/night"), "/read")
  assert.equal(parentPath("/voice"), "/")
  assert.equal(parentPath("/voice/"), "/")
  assert.equal(parentPath("/"), null)
})
