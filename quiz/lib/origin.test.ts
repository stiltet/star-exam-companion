import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import test from "node:test"
import { allowedHostnames, browserOrigin, REFUSED_ORIGIN, sameOrigin } from "./origin.ts"

const request = (headers: Record<string, string>, url = "http://127.0.0.1:47821/api/scores") => new Request(url, { headers })

test("the Mac's own names give their origin, port included", () => {
  assert.equal(browserOrigin(request({ host: "localhost" })), "http://localhost")
  assert.equal(browserOrigin(request({ host: "127.0.0.1:47821" })), "http://127.0.0.1:47821")
  assert.equal(browserOrigin(request({ host: "localhost", "x-forwarded-proto": "https" })), "https://localhost")
})

test("a rebound DNS name is refused even when its Origin would match its Host", () => {
  assert.equal(browserOrigin(request({ host: "evil.example" })), REFUSED_ORIGIN)
  assert.equal(browserOrigin(request({ host: "localhost.evil.example" })), REFUSED_ORIGIN)
})

test("a home-network name is allowed only when QUIZ_LAN_HOST names it", () => {
  // "" stands for unset: undefined would fall back to this shell's own QUIZ_LAN_HOST.
  assert.deepEqual([...allowedHostnames("")], ["localhost", "127.0.0.1", "[::1]"])
  assert.deepEqual([...allowedHostnames("  ")], ["localhost", "127.0.0.1", "[::1]"])
  assert.deepEqual([...allowedHostnames(" Quiz-Mac.local ")], ["localhost", "127.0.0.1", "[::1]", "quiz-mac.local"])
})

// ALLOWED_HOSTNAMES is read once, when the module loads, so each case runs in a fresh process.
function originWith(lanHost: string | undefined, host: string): string {
  const env = { ...process.env }
  delete env.QUIZ_LAN_HOST
  if (lanHost !== undefined) env.QUIZ_LAN_HOST = lanHost
  const script = `import { browserOrigin } from ${JSON.stringify(new URL("./origin.ts", import.meta.url).href)}
process.stdout.write(browserOrigin(new Request("http://127.0.0.1/api/scores", { headers: { host: ${JSON.stringify(host)} } })))`
  const run = spawnSync(process.execPath, ["--input-type=module", "-e", script], { env, encoding: "utf8", timeout: 30_000 })
  assert.equal(run.status, 0, run.stderr)
  return run.stdout
}

test("QUIZ_LAN_HOST lets that one name in, and nothing that merely starts with it", () => {
  assert.equal(originWith(undefined, "quiz-mac.local"), REFUSED_ORIGIN)
  assert.equal(originWith("Quiz-Mac.local", "quiz-mac.local"), "http://quiz-mac.local")
  assert.equal(originWith("quiz-mac.local", "quiz-mac.local.evil.example"), REFUSED_ORIGIN)
  assert.equal(originWith("quiz-mac.local", "localhost"), "http://localhost")
})

test("a forged forwarded protocol is refused", () => {
  assert.equal(browserOrigin(request({ host: "localhost", "x-forwarded-proto": "javascript" })), REFUSED_ORIGIN)
})

test("the refused origin never equals a browser Origin header", () => {
  assert.notEqual(REFUSED_ORIGIN, "null")
  assert.ok(!/^https?:\/\//.test(REFUSED_ORIGIN))
})

test("sameOrigin needs the browser's Origin to match an allowed host", () => {
  assert.equal(sameOrigin(request({ host: "localhost", origin: "http://localhost" })), true)
  assert.equal(sameOrigin(request({ host: "localhost" })), false)
  assert.equal(sameOrigin(request({ host: "evil.example", origin: "http://evil.example" })), false)
})
