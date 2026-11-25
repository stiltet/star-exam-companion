import assert from "node:assert/strict"
import test from "node:test"
import { gateRemaining, LOADING_AFTER_MS, LOADING_MIN_MS, loadingRemaining, routeRemaining } from "./loading-time.ts"

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

test("the page after a Read Aloud box keeps what is left of the box's 500 ms, and nothing when the box never showed", () => {
  assert.equal(routeRemaining(null, 5000), 0)
  // The page is there before the box showed (it shows 200 ms after it mounted).
  assert.equal(routeRemaining(1000, 1000 + LOADING_AFTER_MS - 1), 0)
  // The box showed for 200 ms and the page is there: 300 ms are left.
  assert.equal(routeRemaining(1000, 1400), 300)
  assert.equal(routeRemaining(1000, 1000 + LOADING_AFTER_MS + LOADING_MIN_MS), 0)
  // The moment the box was really seen (its animation ended) wins over the mount time plus 200 ms.
  assert.equal(routeRemaining(1000, 1400, 1230), 330)
  assert.equal(routeRemaining(1000, 1800, 1230), 0)
})
