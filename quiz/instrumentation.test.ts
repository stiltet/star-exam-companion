import assert from "node:assert/strict"
import test from "node:test"
import { register } from "./instrumentation.ts"

test("instrumentation.ts skips Night preload outside Node and when disabled", async (t) => {
  const previousRuntime = process.env.NEXT_RUNTIME
  const previousPreload = process.env.QUIZ_NIGHT_PRELOAD
  t.after(() => {
    if (previousRuntime === undefined) delete process.env.NEXT_RUNTIME
    else process.env.NEXT_RUNTIME = previousRuntime
    if (previousPreload === undefined) delete process.env.QUIZ_NIGHT_PRELOAD
    else process.env.QUIZ_NIGHT_PRELOAD = previousPreload
  })

  process.env.NEXT_RUNTIME = "edge"
  delete process.env.QUIZ_NIGHT_PRELOAD
  await register()

  process.env.NEXT_RUNTIME = "nodejs"
  process.env.QUIZ_NIGHT_PRELOAD = "0"
  await register()

  assert.equal(process.env.NEXT_RUNTIME, "nodejs")
  assert.equal(process.env.QUIZ_NIGHT_PRELOAD, "0")
})
