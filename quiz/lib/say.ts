import { spawn } from "node:child_process"
import { existsSync } from "node:fs"
import { chmod, mkdir, readdir, readFile, rename, rm, stat } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { clipsToEvict, MAX_CACHED_CLIPS, MAX_READING_CLIPS, speechFileName } from "./speak.ts"

// Speaks with macOS `say` and no -v, so the Mac's System voice is used, Siri included.
// Browsers cannot reach Siri voices through speechSynthesis; the speak routes can.
export const VOICE_DIR = path.join(tmpdir(), "star-exam-voice")
// Read Aloud's clips of Google's course text: a pool of their own, readable by this user only, so
// they never evict a Voice Quiz clip and no other account on the Mac can read them.
export const READING_DIR = path.join(tmpdir(), "star-exam-reading")
export type Pool = { dir: string; keep: number }
export const VOICE_POOL: Pool = { dir: VOICE_DIR, keep: MAX_CACHED_CLIPS }
export const READING_POOL: Pool = { dir: READING_DIR, keep: MAX_READING_CLIPS }
const SAY_TIMEOUT_MS = 30000

// One `say` per text at a time: a second request for the same text waits for the first.
const inFlight = new Map<string, Promise<boolean>>()

// At most this many `say` processes at once, whoever on the LAN asks; the rest wait their turn.
const MAX_SAY = 3
let running = 0
const waiting: (() => void)[] = []

async function withSaySlot<T>(work: () => Promise<T>): Promise<T> {
  if (running >= MAX_SAY) await new Promise<void>((resolve) => waiting.push(resolve))
  running += 1
  try {
    return await work()
  } finally {
    running -= 1
    waiting.shift()?.()
  }
}

// Runs `say` without blocking the server, into a temporary name that becomes the clip only when
// `say` succeeds, so a timed-out or killed run never leaves a truncated clip to be served.
function render(text: string, file: string, timeoutMs = SAY_TIMEOUT_MS): Promise<boolean> {
  const partial = `${file}.${process.pid}.partial`
  return new Promise<boolean>((resolve) => {
    const child = spawn("say", ["-f", "-", "-o", partial, "--file-format=WAVE", "--data-format=LEI16@22050"])
    const timer = setTimeout(() => child.kill("SIGKILL"), timeoutMs)
    // A missing `say` is reported to the page as a 500; the page then shows its voice note.
    child.on("error", () => resolve(false))
    // `say` can exit before it reads its input; the write then fails with EPIPE, which close reports.
    child.stdin.on("error", () => undefined)
    child.on("close", (code) => {
      clearTimeout(timer)
      resolve(code === 0)
    })
    child.stdin.end(text)
  }).then(async (ok) => {
    if (ok && existsSync(partial)) {
      await rename(partial, file)
      return true
    }
    await rm(partial, { force: true })
    return false
  })
}

const PARTIAL_MAX_AGE_MS = 10 * 60 * 1000

// Keeps the cache bounded: any LAN client can ask for new texts, so old clips are dropped, and a
// .partial left by a server killed mid-render is removed once it is stale. A file another request
// removes in the meantime is skipped, never an error: eviction must not fail a request.
async function evictOldClips(dir: string, keep: number): Promise<void> {
  const now = Date.now()
  const entries = await Promise.all(
    (await readdir(dir)).map(async (name) => {
      const info = await stat(path.join(dir, name)).catch(() => null)
      return info ? { name, mtimeMs: info.mtimeMs } : null
    }),
  )
  const found = entries.filter((entry): entry is { name: string; mtimeMs: number } => entry !== null)
  const stale = found.filter((entry) => entry.name.endsWith(".partial") && now - entry.mtimeMs > PARTIAL_MAX_AGE_MS)
  const evicted = clipsToEvict(found.filter((entry) => entry.name.endsWith(".wav")), keep)
  await Promise.all([...stale.map((entry) => entry.name), ...evicted].map((name) => rm(path.join(dir, name), { force: true })))
}

// One reading of Night reading: its own timeout, and one slot, so the Voice Quiz still has a free `say`.
export function renderSpeech(text: string, file: string, timeoutMs = SAY_TIMEOUT_MS): Promise<boolean> {
  return withSaySlot(() => render(text, file, timeoutMs))
}

// Renders a text once, however many requests want it, within the say-process cap.
function renderShared(text: string, file: string): Promise<boolean> {
  let run = inFlight.get(file)
  if (!run) {
    run = withSaySlot(() => render(text, file)).finally(() => inFlight.delete(file))
    inFlight.set(file, run)
  }
  return run
}

// The WAV of a text in the Mac's voice, made once and then served from the cache. Another
// request's eviction can remove a clip between the render and the read; then it is rendered once
// more, through the same shared path. Null only when `say` itself failed.
export async function clipFor(text: string, pool: Pool = VOICE_POOL): Promise<Buffer | null> {
  const { dir, keep } = pool
  await mkdir(dir, { recursive: true })
  // Set every time, not only on creation: a folder left looser by an older build is tightened.
  // A folder that cannot be tightened still works, so a failure here never silences a clip.
  await chmod(dir, 0o700).catch(() => undefined)
  const file = path.join(dir, speechFileName(text))
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const cached = existsSync(file) ? await readFile(file).catch(() => null) : null
    if (cached) return cached
    if (!(await renderShared(text, file))) return null
    const clip = await readFile(file).catch(() => null)
    if (clip) {
      // Eviction is housekeeping: a failure leaves a few extra clips, never a failed request.
      await evictOldClips(dir, keep).catch(() => undefined)
      return clip
    }
  }
  return null
}
