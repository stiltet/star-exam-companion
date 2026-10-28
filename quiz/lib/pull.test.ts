import assert from "node:assert/strict"
import test from "node:test"
import { inDeadZone, isReady, isVerticalPull, PULL_TRIGGER_PX, pullAllowedOn, pullDistance, shouldRefresh } from "./pull.ts"

test("the indicator follows half the drag, never upwards and never past its cap", () => {
  assert.equal(pullDistance(-30), 0)
  assert.equal(pullDistance(40), 20)
  assert.equal(pullDistance(1000), 120)
})

test("only a pull that reaches the trigger reloads", () => {
  assert.equal(shouldRefresh(PULL_TRIGGER_PX - 1), false)
  assert.equal(shouldRefresh(PULL_TRIGGER_PX), true)
  assert.equal(shouldRefresh(0), false)
})

test("the ready state matches the release rule", () => {
  assert.equal(isReady(pullDistance(PULL_TRIGGER_PX)), shouldRefresh(PULL_TRIGGER_PX))
  assert.equal(isReady(pullDistance(PULL_TRIGGER_PX - 1)), shouldRefresh(PULL_TRIGGER_PX - 1))
})

test("a sideways swipe that drifts down is not a pull", () => {
  assert.equal(isVerticalPull(10, 100), true)
  assert.equal(isVerticalPull(150, 100), false)
  assert.equal(isVerticalPull(0, -20), false)
})

test("pages holding a round in memory never reload by pulling", () => {
  assert.equal(pullAllowedOn("/exam"), false)
  assert.equal(pullAllowedOn("/voice"), false)
  assert.equal(pullAllowedOn("/practice"), false)
  assert.equal(pullAllowedOn("/flashcards"), false)
  assert.equal(pullAllowedOn("/study/fundamentals"), true)
  assert.equal(pullAllowedOn("/"), true)
})

test("the first few pixels of a touch decide nothing", () => {
  assert.equal(inDeadZone(1, 2), true)
  assert.equal(inDeadZone(0, 0), true)
  assert.equal(inDeadZone(0, 12), false)
})
