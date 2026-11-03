import assert from "node:assert/strict"
import test from "node:test"
import { startNightPreload } from "./night-preload.ts"

test("the Night recording preload does nothing when it is switched off, and never throws", () => {
  const before = process.env.QUIZ_NIGHT_PRELOAD
  process.env.QUIZ_NIGHT_PRELOAD = "0"
  try {
    assert.doesNotThrow(() => startNightPreload())
  } finally {
    if (before === undefined) delete process.env.QUIZ_NIGHT_PRELOAD
    else process.env.QUIZ_NIGHT_PRELOAD = before
  }
})
