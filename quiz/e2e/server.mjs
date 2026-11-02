import { spawn } from "node:child_process"
import { mkdtemp, rm } from "node:fs/promises"
import { createServer } from "node:net"
import { tmpdir } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

const port = Number(process.env.QUIZ_E2E_PORT ?? 47822)
async function checkPort() {
  const probe = createServer()
  try {
    await new Promise((resolve, reject) => {
      probe.once("error", reject)
      probe.listen(port, "localhost", resolve)
    })
  } catch (error) {
    throw new Error(`E2E port ${port} is unavailable. Set QUIZ_E2E_PORT to an unused port.`, { cause: error })
  }
  await new Promise((resolve, reject) => probe.close((error) => error ? reject(error) : resolve()))
}
await checkPort()

const scratch = await mkdtemp(path.join(tmpdir(), "quiz-e2e-"))
const env = {
  ...process.env,
  NEXT_TELEMETRY_DISABLED: "1",
  QUIZ_DIST_DIR: ".next-e2e",
  QUIZ_SCORES_FILE: path.join(scratch, "scores.jsonl"),
  // The tests run Generative AI Leader, whatever exam this machine has chosen on the Progress page.
  QUIZ_EXAM: "generative-ai-leader",
  QUIZ_EXAM_SETTING_FILE: path.join(scratch, "active-exam.json"),
  NIGHT_DIR: path.join(scratch, "night"),
}
const next = fileURLToPath(new URL("../node_modules/next/dist/bin/next", import.meta.url))
const preload = fileURLToPath(new URL("./content-fixture.mjs", import.meta.url))
let child
let stopping = false
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    stopping = true
    child?.kill(signal)
  })
}

function run(args) {
  return new Promise((resolve, reject) => {
    child = spawn(process.execPath, ["--import", preload, next, ...args], { env, stdio: "inherit" })
    child.once("error", reject)
    child.once("exit", (code, signal) => {
      child = undefined
      if (code === 0 || stopping) resolve()
      else reject(new Error(`Next.js ${args[0]} failed: ${signal ?? code}`))
    })
  })
}

try {
  await run(["build"])
  if (!stopping) {
    await checkPort()
    await run(["start", "-H", "localhost", "-p", String(port)])
  }
} finally {
  await rm(scratch, { recursive: true, force: true })
}
