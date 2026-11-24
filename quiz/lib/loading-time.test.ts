import assert from "node:assert/strict"
import test from "node:test"
import { gateRemaining, LOADING_AFTER_MS, LOADING_MIN_MS, loadingRemaining } from "./loading-time.ts"

test("a screen that never showed is not held", () => {
  assert.equal(loadingRemaining(null, 1000), 0)
  assert.equal(gateRemaining(1000, 1100), 0)
  assert.equal(gateRemaining(1000, 1000 + LOADING_AFTER_MS - 1), 0)
})

test("a screen that has shown stays 500 ms", () => {
  assert.equal(LOADING_MIN_MS, 500)
  assert.equal(loadingRemaining(1000, 1100), 400)
  assert.equal(loadingRemaining(1000, 1500), 0)
  assert.equal(loadingRemaining(1000, 5000), 0)
  assert.equal(gateRemaining(1000, 1000 + LOADING_AFTER_MS), LOADING_MIN_MS)
  assert.equal(gateRemaining(1000, 1000 + LOADING_AFTER_MS + 100), LOADING_MIN_MS - 100)
  assert.equal(gateRemaining(1000, 1000 + LOADING_AFTER_MS + LOADING_MIN_MS), 0)
})
