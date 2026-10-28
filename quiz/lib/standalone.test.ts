import assert from "node:assert/strict"
import test from "node:test"
import { isStandalone } from "./standalone.ts"

test("the app counts as installed only when it runs as a home-screen app", () => {
  assert.equal(isStandalone({ displayModeStandalone: true, iosStandalone: undefined }), true)
  assert.equal(isStandalone({ displayModeStandalone: false, iosStandalone: true }), true)
  assert.equal(isStandalone({ displayModeStandalone: false, iosStandalone: false }), false)
  assert.equal(isStandalone({ displayModeStandalone: false, iosStandalone: undefined }), false)
})
