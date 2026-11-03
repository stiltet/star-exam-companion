// Builds the one Night reading file on the Mac. One `say` at a time, through the shared slot, so
// the Voice Quiz keeps a free one. Finished readings are kept, and a restart carries on. The file
// is encoded only when the script's hash changes.

import { spawn } from "node:child_process"
import { createHash } from "node:crypto"
import { createReadStream, existsSync } from "node:fs"
import { appendFile, chmod, mkdir, open, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises"
import { homedir } from "node:os"
import path from "node:path"
import { Readable } from "node:stream"
import { courseBundle } from "./course-text.ts"
import {
  byteRange, chapterList, manifestRecord, nightParts, parseManifest, pcmDuration, pcmOf, sayTimeoutMs, wavFromPcm,
  type NightBuildState, type NightPart, type NightSource,
} from "./night.ts"
import { browserOrigin, REFUSED_ORIGIN } from "./origin.ts"
import { DEFAULT_EXAM, examId, loadPack, repoRoot } from "./pack.ts"
import { reading } from "./reading.ts"
import { renderSpeech } from "./say.ts"

const ENCODE_TIMEOUT_MS = 10 * 60 * 1000

export const BUILD_LOG = "build-errors.log"

// The user's caches folder, which a restart keeps, so the hours of speech are not built again.
export function nightDir(): string {
  const chosen = process.env.NIGHT_DIR
  return chosen && chosen.startsWith("/") ? chosen : path.join(homedir(), "Library", "Caches", "star-exam-night")
}

// Each exam keeps its recording in its own folder, so one exam's build never clears another's. The
// default exam keeps the cache folder itself, where its recording already is.
export function nightDirFor(exam: string = examId()): string {
  return exam === DEFAULT_EXAM ? nightDir() : path.join(nightDir(), exam)
}

export function scriptKey(parts: readonly NightPart[]): string {
  return createHash("sha256").update(parts.map((part) => part.script).join("\n")).digest("hex")
}

// Text and headings only. A review stop or a video stop is a place Read Aloud waits; Night
// reading never receives it, so it reads every paragraph straight through.
// The exam is named by the caller, so a switch part way through a build cannot read another exam's courses
// into this exam's folder.
export async function loadCourseParts(exam: string): Promise<NightPart[]> {
  const courses: NightSource[] = await Promise.all(loadPack(repoRoot(), exam).courses.map(async (course) => {
    const loaded = await courseBundle(course)
    if (!loaded.ok) throw new Error(loaded.error)
    return {
      id: course.id,
      title: course.title,
      readings: loaded.pages.map((page, index) => {
        const found = reading(loaded.bundle, page.id)
        return { number: index + 1, title: page.title, paragraphs: (found?.paragraphs ?? []).map((paragraph) => ({ text: paragraph.text, heading: paragraph.heading })) }
      }),
    }
  }))
  return nightParts(courses)
}

function readAhead(file: string | undefined): Promise<Buffer> | null {
  if (file === undefined) return null
  const read = readFile(file)
  // Its error is thrown where it is awaited. Until then it must not count as unhandled.
  read.catch(() => undefined)
  return read
}

// The next reading is read while this one is written. Only two are held at once, so four hours of
// sound never sits in memory together.
export async function writeJoinedWav(files: readonly string[], dest: string): Promise<number[]> {
  const durations: number[] = []
  const handle = await open(dest, "w")
  let ahead = readAhead(files[0])
  try {
    await handle.write(wavFromPcm(new Uint8Array()))
    let total = 0
    for (let index = 0; index < files.length; index += 1) {
      const current = ahead
      if (!current) break
      ahead = readAhead(files[index + 1])
      const pcm = pcmOf(await current)
      await handle.write(pcm)
      total += pcm.length
      durations.push(pcmDuration(pcm.length))
    }
    const patch = new Uint8Array(4)
    const view = new DataView(patch.buffer)
    view.setUint32(0, 36 + total, true)
    await handle.write(patch, 0, 4, 4)
    view.setUint32(0, total, true)
    await handle.write(patch, 0, 4, 40)
  } finally {
    await handle.close()
  }
  return durations
}

export async function encodeNightAudio(wav: string, m4a: string, timeoutMs = ENCODE_TIMEOUT_MS): Promise<void> {
  const partial = `${m4a}.${process.pid}.partial`
  const ok = await new Promise<boolean>((resolve) => {
    const child = spawn("afconvert", ["-f", "m4af", "-d", "aac ", "-b", "32000", wav, partial])
    const timer = setTimeout(() => child.kill("SIGKILL"), timeoutMs)
    child.on("error", () => resolve(false))
    child.on("close", (code) => {
      clearTimeout(timer)
      resolve(code === 0)
    })
  })
  if (ok && existsSync(partial)) {
    await rename(partial, m4a)
    return
  }
  await rm(partial, { force: true })
  throw new Error("The Mac could not encode the recording.")
}

export type BuildDeps = {
  dir: string
  parts: NightPart[]
  render: (script: string, file: string) => Promise<boolean>
  encode: (wav: string, m4a: string) => Promise<void>
  onProgress?: (done: number, total: number) => void
}

export async function buildRecording(deps: BuildDeps): Promise<Extract<NightBuildState, { state: "ready" }>> {
  if (deps.parts.length === 0) throw new Error("There is nothing to read.")
  await mkdir(deps.dir, { recursive: true })
  // A folder that cannot be tightened still works, so a failure here never stops the build.
  await chmod(deps.dir, 0o700).catch(() => undefined)
  const key = scriptKey(deps.parts)
  const root = path.join(deps.dir, key)
  await mkdir(root, { recursive: true })
  const m4a = path.join(root, "night.m4a")
  const manifestPath = path.join(root, "manifest.json")
  if (existsSync(m4a) && existsSync(manifestPath)) {
    const manifest = parseManifest(await readFile(manifestPath, "utf8"), key)
    const info = await stat(m4a)
    if (manifest && info.size > 0) return { state: "ready", key, bytes: info.size, duration: manifest.duration, chapters: manifest.chapters }
  }
  const total = deps.parts.length
  const files: string[] = []
  let done = 0
  deps.onProgress?.(done, total)
  for (const part of deps.parts) {
    const file = path.join(root, `${String(done).padStart(3, "0")}.wav`)
    files.push(file)
    if (!existsSync(file)) {
      const spoke = await deps.render(part.script, file)
      if (!spoke) throw new Error(`The Mac could not speak reading ${part.number} of course ${part.courseId}.`)
    }
    done += 1
    deps.onProgress?.(done, total)
  }
  const joined = path.join(root, "joined.wav")
  const durations = await writeJoinedWav(files, joined)
  await deps.encode(joined, m4a)
  const chapters = chapterList(deps.parts, durations)
  const duration = durations.reduce((sum, item) => sum + item, 0)
  const bytes = (await stat(m4a)).size
  if (bytes === 0) throw new Error("The Mac encoded an empty recording.")
  const temporary = `${manifestPath}.partial`
  await writeFile(temporary, manifestRecord(key, { duration, chapters }))
  await rename(temporary, manifestPath)
  await rm(joined, { force: true })
  // A `say` that was stopped mid-reading leaves a .partial file behind; the finished build clears it.
  const partials = (await readdir(root)).filter((name) => name.endsWith(".partial")).map((name) => path.join(root, name))
  await Promise.all([...files, ...partials].map((file) => rm(file, { force: true })))
  const old = (await readdir(deps.dir)).filter((name) => /^[0-9a-f]{64}$/.test(name) && name !== key)
  await Promise.all(old.map((name) => rm(path.join(deps.dir, name), { recursive: true, force: true })))
  return { state: "ready", key, bytes, duration, chapters }
}

type Runner = {
  dir: string
  load: () => Promise<NightPart[]>
  render: (script: string, file: string) => Promise<boolean>
  encode: (wav: string, m4a: string) => Promise<void>
}

async function noteFailure(dir: string, message: string, done: number, total: number) {
  try {
    await mkdir(dir, { recursive: true })
    await appendFile(path.join(dir, BUILD_LOG), `${new Date().toISOString()} failed at ${done} of ${total}: ${message.replace(/\s+/g, " ")}\n`)
  } catch {
    // A log that cannot be written leaves the failure on the page, which still shows it.
  }
}

// The page gets the build's own sentences. A system error names a path under the home folder, so
// the page gets a plain sentence for it and the full message stays in the Mac's log.
export function buildProblem(error: unknown): string {
  if (typeof error === "object" && error !== null && "code" in error) return "The Mac could not finish the recording. Try again."
  return error instanceof Error ? error.message : "The Mac could not finish the recording. Try again."
}

// preload: the start made when the server boots or the exam is switched, not by someone opening the page. If it fails
// (the network not up yet), the next ordinary start, the page being opened, tries again without pressing Retry.
export function createNightBuild(deps: Runner): { begin: (retry: boolean, preload?: boolean) => NightBuildState; idle: () => Promise<void> } {
  let job: Promise<void> | null = null
  let status: NightBuildState = { state: "checking" }
  let known = false
  let preloadFailed = false
  const begin = (retry: boolean, preload = false): NightBuildState => {
    if (job) return status
    if (known && !retry && !preloadFailed) return status
    known = true
    preloadFailed = false
    status = { state: "checking" }
    let reached = { done: 0, total: 0 }
    job = (async () => {
      try {
        const parts = await deps.load()
        const ready = await buildRecording({
          dir: deps.dir,
          parts,
          render: deps.render,
          encode: deps.encode,
          onProgress: (done, total) => {
            reached = { done, total }
            status = { state: "building", done, total }
          },
        })
        status = ready
      } catch (error) {
        // The page reads this failed state, and the Mac keeps a line in the night folder's log.
        const { done, total } = reached
        const message = error instanceof Error ? error.message : String(error)
        status = { state: "failed", error: buildProblem(error), done, total }
        preloadFailed = preload
        await noteFailure(deps.dir, message, done, total)
      } finally {
        job = null
      }
    })()
    return status
  }
  // Resolves when the build now running has settled; a test waits on this instead of a timer.
  return { begin, idle: () => job ?? Promise.resolve() }
}

// One build per exam, since each reads its own courses and keeps its own state.
const shared = new Map<string, ReturnType<typeof createNightBuild>>()

export function beginNightBuild(retry: boolean, preload = false): NightBuildState {
  const exam = examId()
  let build = shared.get(exam)
  if (!build) {
    build = createNightBuild({
      dir: nightDirFor(exam),
      load: () => loadCourseParts(exam),
      render: (script, file) => renderSpeech(script, file, sayTimeoutMs(script)),
      encode: encodeNightAudio,
    })
    shared.set(exam, build)
  }
  return build.begin(retry, preload)
}

export function nightStatusResponse(request: Request): Response {
  if (browserOrigin(request) === REFUSED_ORIGIN) {
    return Response.json({ state: "failed", error: "This Mac does not answer to that name.", done: 0, total: 0 }, { status: 400, headers: { "Cache-Control": "no-store" } })
  }
  const retry = new URL(request.url).searchParams.get("retry") === "1"
  return Response.json(beginNightBuild(retry), { headers: { "Cache-Control": "no-store" } })
}

export async function nightAudioResponse(request: Request, params: Promise<{ key: string }>): Promise<Response> {
  if (browserOrigin(request) === REFUSED_ORIGIN) return new Response("Not found", { status: 400 })
  const { key } = await params
  const rangeHeader = request.headers.get("range")
  if (!/^[0-9a-f]{64}$/.test(key)) return new Response("Not found", { status: 404 })
  const file = path.join(nightDirFor(), key, "night.m4a")
  const manifest = path.join(nightDirFor(), key, "manifest.json")
  if (!existsSync(file) || !existsSync(manifest)) return new Response("Not found", { status: 404 })
  const info = await stat(file)
  const range = byteRange(rangeHeader, info.size)
  const headers: Record<string, string> = {
    "Content-Type": "audio/mp4",
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=31536000, immutable",
  }
  if (range.kind === "unsatisfiable") {
    return new Response(null, { status: 416, headers: { ...headers, "Content-Range": `bytes */${info.size}` } })
  }
  if (range.kind === "all") {
    headers["Content-Length"] = String(info.size)
    return new Response(Readable.toWeb(createReadStream(file)) as ReadableStream, { status: 200, headers })
  }
  headers["Content-Length"] = String(range.end - range.start + 1)
  headers["Content-Range"] = `bytes ${range.start}-${range.end}/${info.size}`
  return new Response(Readable.toWeb(createReadStream(file, { start: range.start, end: range.end })) as ReadableStream, { status: 206, headers })
}
