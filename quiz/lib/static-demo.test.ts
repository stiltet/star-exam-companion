import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import test from "node:test"

// STATIC_DEMO is fixed when the module loads, so each case runs in a fresh process.
function postAnswersWith(staticDemo: string | undefined): { called: boolean; result: unknown; demo: boolean } {
  const env = { ...process.env }
  delete env.NEXT_PUBLIC_QUIZ_STATIC
  if (staticDemo !== undefined) env.NEXT_PUBLIC_QUIZ_STATIC = staticDemo
  const url = (file: string) => JSON.stringify(new URL(file, import.meta.url).href)
  const script = `
    import { postAnswers } from ${url("./save.ts")}
    import { STATIC_DEMO } from ${url("./static-demo.ts")}
    let called = false
    const post = async () => { called = true; return new Response(JSON.stringify({ ok: true, stored: ["a"] })) }
    const result = await postAnswers([{ id: "a" }], post)
    process.stdout.write(JSON.stringify({ called, result, demo: STATIC_DEMO }))`
  const run = spawnSync(process.execPath, ["--input-type=module", "-e", script], { env, encoding: "utf8", timeout: 30_000 })
  assert.equal(run.status, 0, run.stderr)
  return JSON.parse(run.stdout) as { called: boolean; result: unknown; demo: boolean }
}

test("the local app sends answers to the server as before", () => {
  const out = postAnswersWith(undefined)
  assert.equal(out.demo, false)
  assert.equal(out.called, true)
  assert.deepEqual(out.result, { stored: ["a"], duplicate: [], rejected: [] })
})

test("only the exact value 1 switches the online demo on", () => {
  assert.equal(postAnswersWith("0").demo, false)
  assert.equal(postAnswersWith("true").demo, false)
  assert.equal(postAnswersWith("1").demo, true)
})

test("the online demo sends nothing, so its answers stay on the device", () => {
  const out = postAnswersWith("1")
  assert.equal(out.called, false)
  assert.equal(out.result, null)
})
