import assert from "node:assert/strict"
import { spawn, spawnSync } from "node:child_process"
import { createServer } from "node:net"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const preload = fileURLToPath(new URL("./content-fixture.mjs", import.meta.url))
const server = fileURLToPath(new URL("./server.mjs", import.meta.url))
const cli = fileURLToPath(new URL("../node_modules/@playwright/test/cli.js", import.meta.url))
const quiz = fileURLToPath(new URL("../", import.meta.url))

test("playwright.config.ts refuses unsafe ports before starting a server", () => {
  for (const port of ["3000", "0", "65536", "not-a-port"]) {
    const result = spawnSync(process.execPath, [cli, "test", "--list"], {
      cwd: quiz, env: { ...process.env, QUIZ_E2E_PORT: port }, encoding: "utf8",
    })
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /QUIZ_E2E_PORT must be an unprivileged port/)
  }
})

test("playwright.config.ts discovers every browser and width without nested or missing specs", () => {
  const result = spawnSync(process.execPath, [cli, "test", "--list"], {
    cwd: quiz, env: { ...process.env, QUIZ_E2E_PORT: "47825" }, encoding: "utf8",
  })
  assert.equal(result.status, 0, result.stderr)
  for (const project of ["chromium-375", "chromium-390", "webkit-375", "webkit-390"]) {
    assert.equal(result.stdout.split(`[${project}]`).length - 1, 29, project)
  }
  assert.match(result.stdout, /Total: 116 tests in 7 files/)
})

test("content-fixture.mjs serves original synthetic readings and passes other fetches through", () => {
  const result = spawnSync(process.execPath, ["--import", preload, "--input-type=module", "-e", `
    const root = "https://storage.googleapis.com/cloud-training/cls-html5-courses/GAIL-Chunked/test/course/en/"
    const bundle = {}
    for (const part of ["contentObjects", "articles", "blocks", "components"]) {
      bundle[part] = await (await fetch(root + part + ".json")).json()
    }
    const skills = await (await fetch("https://www.skills.google/course_templates/1")).text()
    const ordinary = await (await fetch("data:text/plain,untouched")).text()
    process.stdout.write(JSON.stringify({ bundle, skills, ordinary }))
  `], { encoding: "utf8" })
  assert.equal(result.status, 0, result.stderr)
  const { bundle, skills, ordinary } = JSON.parse(result.stdout)
  assert.equal(bundle.contentObjects.length, 2)
  assert.equal(bundle.contentObjects[0]._id, bundle.articles[0]._parentId)
  assert.equal(bundle.articles[0]._id, bundle.blocks[0]._parentId)
  assert.equal(bundle.blocks[0]._id, bundle.components[0]._parentId)
  assert.match(bundle.components[0].body, /original test text/)
  assert.equal(skills, "<html></html>")
  assert.equal(ordinary, "untouched")
})

test("server.mjs refuses an occupied port instead of reusing another quiz's scores", async () => {
  const occupied = createServer()
  await new Promise((resolve) => occupied.listen(0, "localhost", resolve))
  const address = occupied.address()
  assert.ok(address && typeof address === "object")
  try {
    const child = spawn(process.execPath, [server], {
      env: { ...process.env, QUIZ_E2E_PORT: String(address.port) },
      stdio: ["ignore", "pipe", "pipe"],
    })
    let output = ""
    child.stdout.on("data", (chunk) => { output += chunk })
    child.stderr.on("data", (chunk) => { output += chunk })
    const code = await new Promise((resolve, reject) => {
      child.once("error", reject)
      child.once("exit", resolve)
    })
    assert.notEqual(code, 0)
    assert.match(output, /EADDRINUSE/)
    assert.match(output, /Set QUIZ_E2E_PORT to an unused port/)
    assert.doesNotMatch(output, /Starting|Creating an optimized/)
  } finally {
    await new Promise((resolve, reject) => occupied.close((error) => error ? reject(error) : resolve()))
  }
})

test("playwright.config.ts waits for its own server stdout, never a foreign HTTP response", () => {
  const result = spawnSync(process.execPath, ["--input-type=module", "-e", `
    const { default: config } = await import("./playwright.config.ts")
    if (config.webServer.url !== undefined) throw new Error("URL polling can accept another server")
    if (!config.webServer.wait.stdout.test("Ready in 100ms")) throw new Error("Missing startup handshake")
  `], { cwd: quiz, encoding: "utf8" })
  assert.equal(result.status, 0, result.stderr)
})
