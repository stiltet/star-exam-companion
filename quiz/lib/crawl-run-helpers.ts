import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises"
import { createServer } from "node:net"
import { tmpdir } from "node:os"
import path from "node:path"
import { startFakeSite, type FakeCard, type FakeSite } from "./fake-lesson-site.ts"
import { readPrivateReadings } from "./private-reading.ts"
import { testRoot } from "./test-pack.ts"

// These tests run the real command, `node scripts/reading-crawl.mts`, against a fake lesson site that serves made-up lessons, with a
// scratch exam, a scratch private store and a scratch browser profile. No real Google page and no real lesson text is involved.

export const quiz = path.join(testRoot, "quiz")

export async function freePort(): Promise<number> {
  const probe = createServer()
  await new Promise<void>((resolve) => probe.listen(0, "127.0.0.1", resolve))
  const port = (probe.address() as { port: number }).port
  await new Promise<void>((resolve) => probe.close(() => resolve()))
  return port
}

// A scratch copy of the exams with one more: "crawl-test", whose two courses (templates 9001 and 9002) are private.
export async function scratch(): Promise<string> {
  const base = await mkdtemp(path.join(tmpdir(), "crawl-run-"))
  const exams = path.join(base, "root", "exams")
  await mkdir(exams, { recursive: true })
  await cp(path.join(testRoot, "exams", "generative-ai-leader"), path.join(exams, "generative-ai-leader"), { recursive: true })
  const pack = path.join(exams, "crawl-test")
  await cp(path.join(testRoot, "exams", "agentic-architect"), pack, { recursive: true })
  const meta = JSON.parse(await readFile(path.join(pack, "pack.json"), "utf8"))
  await writeFile(path.join(pack, "pack.json"), JSON.stringify({ ...meta, id: "crawl-test", title: "Crawl Test Exam" }))
  const courses = JSON.parse(await readFile(path.join(pack, "courses.json"), "utf8"))
  await writeFile(path.join(pack, "courses.json"), JSON.stringify({
    path: courses.path,
    bundleBase: courses.bundleBase,
    courses: [
      { id: "1", template: "9001", title: "First Course", provider: "private" },
      { id: "2", template: "9002", title: "Second Course", provider: "private" },
    ],
  }))
  return base
}

export type Run = { code: number | null; out: string; port: number }

// extra replaces or adds environment settings; a value of undefined removes one.
export async function runCrawl(base: string, site: FakeSite, extra: Record<string, string | undefined> = {}, flags: string[] = []): Promise<Run> {
  const port = await freePort()
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    NO_COLOR: "1",
    QUIZ_ROOT: path.join(base, "root"),
    QUIZ_PRIVATE_DIR: path.join(base, "private"),
    READING_SITE: site.url,
    READING_CDP_URL: `http://127.0.0.1:${port}`,
    READING_PROFILE_DIR: path.join(base, "profile"),
    READING_FRAME_HOSTS: "127.0.0.1",
    READING_SKIP_SIGNIN: "1",
    READING_PAUSE_MS: "0",
    READING_RETRY_BASE_MS: "50",
    READING_SETTLE_MS: "400",
    // The lesson list is read again and again until the count holds; the command waits 1.5 s between reads. The tests that check that wait set their own.
    READING_LIST_SETTLE_MS: "200",
    // A page with no card is waited for 30 s, and a list still changing 30 s, by default; the fake site answers at once, so a short wait shows the same behaviour.
    READING_LIST_WAIT_MS: "1500",
    READING_LIST_MAX_MS: "5000",
    // The settling lesson of the fake site changes its text after 800 ms, so the shortest watch stays well past that.
    READING_MIN_WATCH_MS: "1000",
    READING_EMPTY_AFTER_MS: "2500",
  }
  // A shell that is set up for the real capture must not change a test: the account and the debug setting are the tests' own to give.
  delete env.READING_GOOGLE_ACCOUNT
  delete env.READING_DEBUG
  for (const [key, value] of Object.entries(extra)) {
    if (value === undefined) delete env[key]
    else env[key] = value
  }
  const child = spawn(process.execPath, ["scripts/reading-crawl.mts", "crawl-test", ...flags], { cwd: quiz, env })
  let out = ""
  child.stdout.on("data", (chunk) => { out += String(chunk) })
  child.stderr.on("data", (chunk) => { out += String(chunk) })
  const code = await new Promise<number | null>((resolve) => child.on("close", resolve))
  return { code, out, port }
}

// The store is read in this process, so it points at the scratch folder while a test looks at it.
export async function saved(base: string, course: string) {
  const before = process.env.QUIZ_PRIVATE_DIR
  process.env.QUIZ_PRIVATE_DIR = path.join(base, "private")
  try {
    return await readPrivateReadings("crawl-test", course)
  } finally {
    if (before === undefined) delete process.env.QUIZ_PRIVATE_DIR
    else process.env.QUIZ_PRIVATE_DIR = before
  }
}

export function noLessonText(run: Run, texts: string[]): void {
  for (const text of texts) assert.equal(run.out.includes(text), false, "the output never holds lesson text")
}

// The browser the crawl started must be gone once the command ends. It may take a moment to finish closing, so look for a few seconds.
export async function browserClosed(port: number): Promise<boolean> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    try {
      await fetch(`http://127.0.0.1:${port}/json/version`, { signal: AbortSignal.timeout(1_000) })
    } catch {
      // A refused connection is the answer this waits for: nothing listens on the port, so the browser is gone.
      return true
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  return false
}

export const INTRO = "Synthetic intro lesson text that is long enough to be a reading."
export const REPEAT_ONE = "Synthetic first repeated-title lesson text, long enough to count."
export const REPEAT_TWO = "Synthetic second repeated-title lesson text, long enough to count."
export const SETTLED = "Synthetic settled lesson text that appears after the page has loaded."
export const DOCUMENT = "Synthetic document lesson text that is long enough to be a reading."
export const PDF = "Synthetic pdf lesson text that is long enough to be read from a PDF"

export const KEEP = "Synthetic text of the second lesson that stays, long enough to count as a reading."
export const GONE = "Synthetic text of a lesson Google removes later, long enough to count as a reading."
export const NEW_LESSON = "Synthetic text of a lesson Google adds later, long enough to count as a reading."
export const ONE = "Synthetic text of a lesson that stays, long enough to count as a reading."
export const before = (): Record<string, FakeCard[]> => ({
  "9001": [{ title: "Stays lesson", kind: "bundle", text: ONE }],
  "9002": [{ title: "Also stays", kind: "bundle", text: KEEP }, { title: "Goes away", kind: "bundle", text: GONE }],
})
export const after = (): Record<string, FakeCard[]> => ({
  "9001": [{ title: "Stays lesson", kind: "bundle", text: ONE }],
  "9002": [{ title: "Also stays", kind: "bundle", text: KEEP }, { title: "Brand new lesson", kind: "bundle", text: NEW_LESSON }],
})
