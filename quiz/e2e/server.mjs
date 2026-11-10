import { createHash } from "node:crypto"
import { spawn, spawnSync } from "node:child_process"
import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises"
import { createServer } from "node:net"
import path from "node:path"
import { fileURLToPath } from "node:url"
import "./content-fixture.mjs"
import { seedNight } from "./night-fixture.mjs"
import { browserServerEnv, e2eScratch } from "./server-env.mjs"

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

// A fixed scratch folder per port (the port check above stops two servers sharing one), so the tests also know where
// the server keeps its private readings.
const scratch = e2eScratch(port)
await rm(scratch, { recursive: true, force: true })
await mkdir(scratch, { recursive: true, mode: 0o700 })
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
// An explicit empty file override also blocks a QUIZ_SCORES_FILE from .env.local. The scratch folder
// keeps one file per exam, and the chosen exam and Night recording stay in scratch as well.
const env = browserServerEnv(process.env, scratch, root)
const privateText = ["Synthetic private fixture", "used only by the offline browser test."].join(" ")
// A second synthetic page with two paragraphs, for the next-paragraph and leave-the-page checks. Its lines are joined here
// so the whole text never appears in a tracked file, which the check below enforces for every fixture text.
const twoParagraphs = [["First synthetic", "paragraph."].join(" "), ["Second synthetic", "paragraph."].join(" ")].join("\n")
const privateCourse = path.join(env.QUIZ_PRIVATE_DIR, "agentic-architect", "12")
await mkdir(privateCourse, { recursive: true })
for (const [pageId, title, text] of [["98001", "Synthetic private fixture", privateText], ["98002", "Synthetic two paragraphs", twoParagraphs]]) {
  await writeFile(path.join(privateCourse, `${createHash("sha256").update(pageId).digest("hex")}.json`), JSON.stringify({
    pageId,
    title,
    text,
    savedAt: "2026-01-01T00:00:00.000Z",
  }))
}

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
const tracked = spawnSync("git", ["ls-files", "-z"], { cwd: repo })
if (tracked.status !== 0) throw new Error("Could not verify that the private fixture is absent from git ls-files.")
for (const file of tracked.stdout.toString("utf8").split("\0").filter(Boolean)) {
  const content = await readFile(path.join(repo, file))
  for (const fixtureText of [privateText, ...twoParagraphs.split("\n")]) {
    if (content.includes(Buffer.from(fixtureText))) throw new Error("Synthetic private fixture text must not appear in git ls-files.")
  }
}

async function containsText(directory, text) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      if (await containsText(file, text)) return true
    } else if ((await readFile(file)).includes(Buffer.from(text))) {
      return true
    }
  }
  return false
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
  // The seeded Night recording must be for the same readings the server will see, private fixture included.
  process.env.QUIZ_PRIVATE_DIR = env.QUIZ_PRIVATE_DIR
  await seedNight()
  await run(["build"])
  const built = path.join(path.dirname(fileURLToPath(import.meta.url)), "../.next-e2e")
  let leaked = false
  for (const fixtureText of [privateText, ...twoParagraphs.split("\n")]) leaked = leaked || await containsText(built, fixtureText)
  if (leaked) {
    throw new Error("Synthetic private fixture text must not appear in the E2E build output.")
  }
  if (!stopping) {
    await checkPort()
    await run(["start", "-H", "localhost", "-p", String(port)])
  }
} finally {
  await rm(scratch, { recursive: true, force: true })
}
