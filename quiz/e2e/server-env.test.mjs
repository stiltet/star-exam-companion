import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { createRequire } from "node:module"
import { tmpdir } from "node:os"
import path from "node:path"
import test from "node:test"
import { browserServerEnv, E2E_DEFAULT_PORT, E2E_WORKERS, e2eBasePort, e2ePortFor } from "./server-env.mjs"

test("the browser server keeps inherited and .env.local score overrides out of its scratch instance", () => {
  const scratch = mkdtempSync(path.join(tmpdir(), "quiz-e2e-env-"))
  try {
    const unsafe = path.join(scratch, "not-test-scores.jsonl")
    writeFileSync(path.join(scratch, ".env.local"), `QUIZ_SCORES_FILE=${unsafe}\nQUIZ_SCORES_DIR=${unsafe}\n`)
    const env = browserServerEnv({ ...process.env, QUIZ_SCORES_FILE: unsafe, QUIZ_SCORES_DIR: unsafe }, scratch, path.join(scratch, "root"))
    const require = createRequire(import.meta.url)
    const fromNext = createRequire(require.resolve("next/package.json"))
    const loader = fromNext.resolve("@next/env")
    const script = "const { loadEnvConfig } = require(process.argv[1]); loadEnvConfig(process.argv[2], true); process.stdout.write(JSON.stringify({ file: process.env.QUIZ_SCORES_FILE, dir: process.env.QUIZ_SCORES_DIR }))"
    const result = spawnSync(process.execPath, ["-e", script, loader, scratch], { env, encoding: "utf8" })
    assert.equal(result.status, 0, result.stderr)
    assert.deepEqual(JSON.parse(result.stdout), { file: "", dir: path.join(scratch, "scores") })
    assert.equal(env.QUIZ_ROOT, path.join(scratch, "root"))
    assert.equal(env.QUIZ_EXAM_SETTING_FILE, path.join(scratch, "active-exam.json"))
    assert.equal(env.NIGHT_DIR, path.join(scratch, "night"))
  } finally {
    rmSync(scratch, { recursive: true, force: true })
  }
})

test("the browser server isolates OS-temp speech pools from inherited temp settings", () => {
  const scratch = mkdtempSync(path.join(tmpdir(), "quiz-e2e-speech-env-"))
  try {
    const env = browserServerEnv({ ...process.env, TMPDIR: "/unused-test-temp", TMP: "/unused-test-temp", TEMP: "/unused-test-temp" }, scratch, path.join(scratch, "root"))
    const script = `
      import { tmpdir } from "node:os"
      import { VOICE_DIR, READING_DIR } from "./lib/say.ts"
      process.stdout.write(JSON.stringify({ tmp: tmpdir(), voice: VOICE_DIR, reading: READING_DIR }))
    `
    const result = spawnSync(process.execPath, ["--input-type=module", "-e", script], {
      cwd: new URL("../", import.meta.url), env, encoding: "utf8",
    })
    assert.equal(result.status, 0, result.stderr)
    assert.deepEqual(JSON.parse(result.stdout), {
      tmp: scratch,
      voice: path.join(scratch, "star-exam-voice"),
      reading: path.join(scratch, "star-exam-reading"),
    })
    for (const name of ["TMPDIR", "TMP", "TEMP"]) assert.equal(env[name], scratch)
  } finally {
    rmSync(scratch, { recursive: true, force: true })
  }
})

test("the base port is QUIZ_E2E_PORT, or the default when it is not set", () => {
  assert.equal(e2eBasePort({}), E2E_DEFAULT_PORT)
  assert.equal(e2eBasePort({ QUIZ_E2E_PORT: "47850" }), 47850)
})

test("every worker's server has its own port, counted up from the base port", () => {
  const ports = Array.from({ length: E2E_WORKERS }, (_, index) => e2ePortFor(47850, index))
  assert.equal(new Set(ports).size, E2E_WORKERS)
  assert.equal(ports[0], 47850)
})
