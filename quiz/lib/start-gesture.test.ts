import assert from "node:assert/strict"
import test from "node:test"
import { startsReading } from "./start-gesture.ts"

test("a touch or click on the page outside any control starts the reading", () => {
  assert.equal(startsReading({ type: "touchend", onControl: false }), true)
  assert.equal(startsReading({ type: "click", onControl: false }), true)
})

test("a touch on a control is left to the control, so Start and an answer each run once", () => {
  assert.equal(startsReading({ type: "touchend", onControl: true }), false)
  assert.equal(startsReading({ type: "click", onControl: true }), false)
  assert.equal(startsReading({ type: "keydown", key: "Enter", onControl: true }), false)
})

test("only Enter and Space start the reading from the keyboard; Tab and Shift move focus", () => {
  assert.equal(startsReading({ type: "keydown", key: "Enter", onControl: false }), true)
  assert.equal(startsReading({ type: "keydown", key: " ", onControl: false }), true)
  assert.equal(startsReading({ type: "keydown", key: "Tab", onControl: false }), false)
  assert.equal(startsReading({ type: "keydown", key: "Shift", onControl: false }), false)
})
