import assert from "node:assert/strict"
import { registerHooks } from "node:module"
import test from "node:test"
import { register } from "./instrumentation.ts"

test("instrumentation.ts starts Night preload only on Node when enabled", async (t) => {
  const previousRuntime = process.env.NEXT_RUNTIME
  const previousPreload = process.env.QUIZ_NIGHT_PRELOAD
  const startKey = Symbol.for("quiz.instrumentation.test.start")
  let imports = 0
  let starts = 0
  Reflect.set(globalThis, startKey, () => { starts += 1 })
  const stub = `data:text/javascript,${encodeURIComponent('export function startNightPreload(){Reflect.get(globalThis,Symbol.for("quiz.instrumentation.test.start"))()}')}`
  const parent = new URL("./instrumentation.ts", import.meta.url).href
  const hooks = registerHooks({
    resolve(specifier, context, nextResolve) {
      if (specifier === "./lib/night-preload.ts" && context.parentURL === parent) {
        imports += 1
        return { url: stub, shortCircuit: true }
      }
      return nextResolve(specifier, context)
    },
  })
  t.after(() => {
    hooks.deregister()
    Reflect.deleteProperty(globalThis, startKey)
    if (previousRuntime === undefined) delete process.env.NEXT_RUNTIME
    else process.env.NEXT_RUNTIME = previousRuntime
    if (previousPreload === undefined) delete process.env.QUIZ_NIGHT_PRELOAD
    else process.env.QUIZ_NIGHT_PRELOAD = previousPreload
  })

  process.env.NEXT_RUNTIME = "edge"
  delete process.env.QUIZ_NIGHT_PRELOAD
  await register()
  assert.equal(imports, 0)
  assert.equal(starts, 0)

  process.env.NEXT_RUNTIME = "nodejs"
  process.env.QUIZ_NIGHT_PRELOAD = "0"
  await register()
  assert.equal(imports, 0)
  assert.equal(starts, 0)

  delete process.env.QUIZ_NIGHT_PRELOAD
  await register()
  assert.equal(imports, 1)
  assert.equal(starts, 1)
})
