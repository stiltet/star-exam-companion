import assert from "node:assert/strict"
import { spawn, spawnSync } from "node:child_process"
import { mkdtempSync, rmSync } from "node:fs"
import { createServer } from "node:net"
import { tmpdir } from "node:os"
import path from "node:path"
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
    assert.equal(result.stdout.split(`[${project}]`).length - 1, 32, project)
  }
  assert.match(result.stdout, /Total: 128 tests in 8 files/)
})

test("content-fixture.mjs serves original synthetic readings and passes other fetches through", () => {
  const result = spawnSync(process.execPath, ["--import", preload, "--input-type=module", "-e", `
    const root = "https://storage.googleapis.com/cloud-training/cls-html5-courses/GAIL-Chunked/test/course/en/"
    const bundle = {}
    for (const part of ["contentObjects", "articles", "blocks", "components"]) {
      bundle[part] = await (await fetch(root + part + ".json")).json()
    }
    const rise = await (await fetch("https://storage.googleapis.com/cloud-training/cls-html5-courses/test/EN/runtime-data.js")).text()
    const skills = await (await fetch("https://www.skills.google/course_templates/1")).text()
    const ordinary = await (await fetch("data:text/plain,untouched")).text()
    process.stdout.write(JSON.stringify({ bundle, rise, skills, ordinary }))
  `], { encoding: "utf8" })
  assert.equal(result.status, 0, result.stderr)
  const { bundle, rise, skills, ordinary } = JSON.parse(result.stdout)
  assert.equal(bundle.contentObjects.length, 2)
  assert.equal(bundle.contentObjects[0]._id, bundle.articles[0]._parentId)
  assert.equal(bundle.articles[0]._id, bundle.blocks[0]._parentId)
  assert.equal(bundle.blocks[0]._id, bundle.components[0]._parentId)
  assert.match(bundle.components[0].body, /original test text/)
  const encoded = /^__jsonp\("runtime-data\.js","([^"]+)"\)$/.exec(rise)?.[1]
  assert.ok(encoded, "the Rise fixture must be a runtime-data.js payload")
  const course = JSON.parse(Buffer.from(encoded, "base64").toString("utf8"))
  assert.deepEqual(course.course.lessons.map((lesson) => lesson.id), ["000000000000000000000001", "000000000000000000000002"])
  assert.equal(skills, "<html></html>")
  assert.equal(ordinary, "untouched")
})

test("night-fixture.mjs seeds separate real manifests using synthetic course text and silent audio", (t) => {
  const dir = mkdtempSync(path.join(tmpdir(), "night-fixture-"))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const result = spawnSync(process.execPath, ["--import", preload, "--input-type=module", "-e", `
    import { seedNight } from "./e2e/night-fixture.mjs"
    import { nightDirFor } from "./lib/night-build.ts"
    import { readFile, readdir } from "node:fs/promises"
    import path from "node:path"
    await seedNight()
    const result = {}
    for (const exam of ["generative-ai-leader", "agentic-architect"]) {
      const root = nightDirFor(exam)
      const keys = (await readdir(root)).filter((name) => /^[0-9a-f]{64}$/.test(name))
      if (keys.length !== 1) throw new Error("Expected one seeded recording for " + exam)
      const folder = path.join(root, keys[0])
      const manifest = JSON.parse(await readFile(path.join(folder, "manifest.json"), "utf8"))
      const audio = await readFile(path.join(folder, "night.m4a"))
      result[exam] = { key: keys[0], manifest, bytes: audio.length, format: audio.subarray(4, 8).toString() }
    }
    process.stdout.write(JSON.stringify(result))
  `], { cwd: quiz, env: { ...process.env, QUIZ_ROOT: path.resolve(quiz, ".."), NIGHT_DIR: dir }, encoding: "utf8" })
  assert.equal(result.status, 0, result.stderr)
  const records = JSON.parse(result.stdout)
  const first = records["generative-ai-leader"]
  const second = records["agentic-architect"]
  assert.notEqual(first.key, second.key)
  assert.equal(first.manifest.hash, first.key)
  assert.equal(second.manifest.hash, second.key)
  assert.equal(first.manifest.chapters[0].courseTitle, "Gen AI: Beyond the Chatbot")
  assert.equal(second.manifest.chapters[0].courseTitle, "Manage Agent Memory and State")
  assert.ok(second.manifest.chapters.some((chapter) => chapter.title === "Test Rise reading one"))
  assert.ok(first.bytes > 0 && second.bytes > 0)
  assert.equal(first.format, "ftyp")
  assert.equal(second.format, "ftyp")
})

test("content-fixture.mjs refuses speech generation on every platform", () => {
  const result = spawnSync(process.execPath, ["--import", preload, "--input-type=module", "-e", `
    import { spawn } from "node:child_process"
    for (const command of ["say", "afconvert"]) {
      try {
        spawn(command, [])
        throw new Error("Speech generation was not blocked")
      } catch (error) {
        if (error.message !== "Browser tests must not run " + command) throw error
      }
    }
    const child = spawn(process.execPath, ["-e", "process.stdout.write('allowed')"], { stdio: "inherit" })
    child.on("exit", (code) => { if (code !== 0) process.exitCode = 1 })
  `], { encoding: "utf8" })
  assert.equal(result.status, 0, result.stderr)
  assert.equal(result.stdout, "allowed")
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
