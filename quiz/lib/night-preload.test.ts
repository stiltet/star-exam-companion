import assert from "node:assert/strict"
import test from "node:test"
import { createNightBuild } from "./night-build.ts"
import { startNightPreload } from "./night-preload.ts"

function withPreload<T>(value: string | undefined, run: () => T): T {
  const before = process.env.QUIZ_NIGHT_PRELOAD
  if (value === undefined) delete process.env.QUIZ_NIGHT_PRELOAD
  else process.env.QUIZ_NIGHT_PRELOAD = value
  try {
    return run()
  } finally {
    if (before === undefined) delete process.env.QUIZ_NIGHT_PRELOAD
    else process.env.QUIZ_NIGHT_PRELOAD = before
  }
}

test("the preload starts the build once, as a preload, for an exam with reading", () => {
  const calls: unknown[][] = []
  withPreload(undefined, () => startNightPreload((...args) => calls.push(args), () => true))
  assert.deepEqual(calls, [[false, true]])
})

test("the preload does nothing when it is switched off, or the exam has no reading", () => {
  const calls: unknown[][] = []
  withPreload("0", () => startNightPreload((...args) => calls.push(args), () => true))
  withPreload(undefined, () => startNightPreload((...args) => calls.push(args), () => false))
  assert.deepEqual(calls, [])
})

test("a preload that throws is swallowed", () => {
  withPreload(undefined, () => assert.doesNotThrow(() => startNightPreload(() => { throw new Error("no network") }, () => true)))
})

test("a build whose preload failed is tried again by the next ordinary start, without Retry", async () => {
  let loads = 0
  const build = createNightBuild({
    dir: "/nonexistent-night-dir",
    load: async () => { loads += 1; throw new Error("no network") },
    render: async () => true,
    encode: async () => undefined,
  })
  build.begin(false, true)
  await new Promise((resolve) => setTimeout(resolve, 50))
  assert.equal(loads, 1)
  build.begin(false)
  await new Promise((resolve) => setTimeout(resolve, 50))
  assert.equal(loads, 2, "the page opening starts a fresh attempt after a failed preload")
  build.begin(false)
  await new Promise((resolve) => setTimeout(resolve, 50))
  assert.equal(loads, 2, "an ordinary failed start waits for Retry as before")
})
