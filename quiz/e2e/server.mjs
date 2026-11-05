import { spawn } from "node:child_process"
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { createServer } from "node:net"
import { tmpdir } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import "./content-fixture.mjs"
import { seedNight } from "./night-fixture.mjs"

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
await mkdir(path.join(scratch, "scores"))
// A scratch copy of the packs, with one more that has no course to read, so the tests can serve a pack the repo
// does not ship. It is the second pack with its Read Aloud courses taken out.
const root = path.join(scratch, "root")
await mkdir(path.join(root, "quiz"), { recursive: true })
await cp(fileURLToPath(new URL("../../exams", import.meta.url)), path.join(root, "exams"), { recursive: true })
const bare = path.join(root, "exams", "no-course-test")
await cp(path.join(root, "exams", "agentic-architect"), bare, { recursive: true })
const meta = JSON.parse(await readFile(path.join(bare, "pack.json"), "utf8"))
await writeFile(path.join(bare, "pack.json"), JSON.stringify({ ...meta, id: "no-course-test", title: "Exam With No Course", reading: false }, null, 2))
await rm(path.join(bare, "courses.json"))
const env = {
  ...process.env,
  NEXT_TELEMETRY_DISABLED: "1",
  QUIZ_DIST_DIR: ".next-e2e",
  // A scratch folder, with one file per exam as the real app keeps them, so a test can answer in two exams.
  QUIZ_SCORES_DIR: path.join(scratch, "scores"),
  QUIZ_ROOT: root,
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
  process.env.QUIZ_ROOT = root
  process.env.NIGHT_DIR = env.NIGHT_DIR
  await seedNight()
  await run(["build"])
  if (!stopping) {
    await checkPort()
    await run(["start", "-H", "localhost", "-p", String(port)])
  }
} finally {
  await rm(scratch, { recursive: true, force: true })
}
