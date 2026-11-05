// The script for Night reading: every course, then every reading, in the learning path's order,
// said straight through. Read Aloud's review and video stops are not used. The pauses are `say`
// commands, so the joined file keeps playing while the phone is locked and no script has to run.

import { saidHeading, speakable } from "./score.ts"
import { sentences } from "./spoken-word.ts"

// The same gaps Read Aloud leaves, then a longer one between readings and between courses.
export const PAUSE_PARAGRAPH_MS = 350
export const PAUSE_HEADING_MS = 700
export const PAUSE_READING_MS = 2000
export const PAUSE_COURSE_MS = 4000

// `say` renders about eight times faster than it speaks (measured 21 Oct). A reading is given
// four times that, and at least a minute, so a long page is not cut off. Twenty minutes is the cap.
const WORDS_PER_MIN = 151
const RENDER_TIMES_FASTER = 8

export const WAV_RATE = 22050

export { NIGHT_PLACE_KEY } from "./scope.ts"

export function nightCacheUrl(key: string, exam: string): string {
  return `/api/night/audio/${key}?exam=${encodeURIComponent(exam)}`
}

/**
 * Whether a cached request is an older recording that a newly stored one replaces: the same exam's
 * audio under another key. An older build stored the default exam's recording with no exam name, so
 * for the default exam an unnamed entry is replaced too, or it would stay on the device for good.
 */
export function replacedNightEntry(requestUrl: string, keepUrl: string, exam: string, defaultExam: string): boolean {
  const url = new URL(requestUrl, "http://device.invalid")
  if (!url.pathname.startsWith("/api/night/audio/")) return false
  const keep = new URL(keepUrl, "http://device.invalid")
  if (url.pathname + url.search === keep.pathname + keep.search) return false
  const named = url.searchParams.get("exam")
  return named === exam || (named === null && exam === defaultExam)
}

// A store keeps exactly the length the Mac named, and the whole transfer is given five minutes.
export const STORE_TIMEOUT_MS = 5 * 60 * 1000

// A status check is given five seconds. Checks repeat two seconds apart, and after half a minute
// with no answer the page says the Mac is not answering and stops asking until Try again.
export const STATUS_TIMEOUT_MS = 5000
export const STATUS_GAP_MS = 2000
export const STATUS_GIVE_UP_MS = 30_000

// The manifest's layout. A manifest of another version is rebuilt rather than read.
export const MANIFEST_VERSION = 1

/**
 * Ask the Mac again. A build keeps being watched, and so does the first check with nothing stored,
 * until the Mac has not answered for half a minute. missedFor is null when the last check answered.
 */
export function keepWatching(last: NightRemote["state"] | null, stored: boolean, missedFor: number | null): boolean {
  if (missedFor !== null && missedFor >= STATUS_GIVE_UP_MS) return false
  if (last === "building" || last === "checking") return true
  return missedFor !== null && last === null && !stored
}

export type NightParagraph = { text: string; heading: boolean }

export type NightSource = {
  id: string
  title: string
  readings: { number: number; title: string; paragraphs: NightParagraph[] }[]
}

export type NightPart = {
  courseId: string
  courseTitle: string
  number: number
  title: string
  script: string
}

export type NightChapter = {
  courseId: string
  courseTitle: string
  number: number
  title: string
  start: number
}

// checking: the Mac is loading the text and looking at the recording it has, which speaks nothing,
// so the page says nothing. building: it is speaking readings that are not yet recorded.
export type NightBuildState =
  | { state: "checking" }
  | { state: "building"; done: number; total: number }
  | { state: "ready"; key: string; bytes: number; duration: number; chapters: NightChapter[] }
  | { state: "failed"; error: string; done: number; total: number }

// What the page knows about the Mac. offline keeps the last build progress, so the page can say
// how far the recording had got when the Mac stopped answering.
export type NightRemote = NightBuildState | { state: "offline"; done: number; total: number }

export type NightPlace = { key: string; seconds: number; bytes: number; chapters: NightChapter[] }

function pauseCommand(ms: number): string {
  return `[[slnc ${ms}]]`
}

// Google's text is not allowed to carry a `say` command. Only the pauses added below are.
function withoutCommands(text: string): string {
  return text.replace(/\[\[|\]\]/g, "")
}

function spokenLine(text: string, heading: boolean): string {
  const plain = withoutCommands(text).replace(/\s+/g, " ").trim()
  if (!plain) return ""
  if (heading) return saidHeading(speakable(plain))
  const parts = sentences(plain).map((part) => speakable(part.text)).filter((part) => part.length > 0)
  return parts.length > 0 ? parts.join(" ") : speakable(plain)
}

// One part per reading that has something to say. A review-only page is left out. The number is
// the reading's place in the course, so "Reading 3." matches the course list.
export function nightParts(courses: readonly NightSource[]): NightPart[] {
  const parts: NightPart[] = []
  for (const course of courses) {
    const readable = course.readings.flatMap((reading) => {
      const lines = reading.paragraphs
        .map((paragraph) => ({ line: spokenLine(paragraph.text, paragraph.heading), heading: paragraph.heading }))
        .filter((paragraph) => paragraph.line.length > 0)
      return lines.length > 0 ? [{ reading, lines }] : []
    })
    readable.forEach(({ reading, lines }, index) => {
      const pieces: string[] = []
      if (index === 0) pieces.push(saidHeading(speakable(`Course ${course.id}. ${course.title}`)), pauseCommand(PAUSE_HEADING_MS))
      pieces.push(saidHeading(speakable(`Reading ${reading.number}`)), pauseCommand(PAUSE_HEADING_MS))
      lines.forEach((paragraph, lineIndex) => {
        const end = lineIndex === lines.length - 1
        const between = index === readable.length - 1 ? PAUSE_COURSE_MS : PAUSE_READING_MS
        const pause = end ? between : paragraph.heading ? PAUSE_HEADING_MS : PAUSE_PARAGRAPH_MS
        pieces.push(paragraph.line, pauseCommand(pause))
      })
      parts.push({ courseId: course.id, courseTitle: course.title, number: reading.number, title: reading.title, script: pieces.join(" ") })
    })
  }
  return parts
}

export function sayTimeoutMs(script: string): number {
  const words = script.split(/\s+/).filter((word) => word.length > 0).length
  const renderMs = (words * 60_000) / WORDS_PER_MIN / RENDER_TIMES_FASTER
  return Math.min(20 * 60_000, Math.max(60_000, Math.ceil(renderMs * 4)))
}

export function chapterList(parts: readonly NightPart[], durations: readonly number[]): NightChapter[] {
  if (parts.length !== durations.length) throw new Error("each reading needs its own duration")
  let start = 0
  return parts.map((part, index) => {
    const chapter = { courseId: part.courseId, courseTitle: part.courseTitle, number: part.number, title: part.title, start: Math.round(start * 1000) / 1000 }
    start += durations[index] ?? 0
    return chapter
  })
}

export function chapterAt(chapters: readonly NightChapter[], time: number): NightChapter | null {
  if (chapters.length === 0 || !Number.isFinite(time)) return null
  let found: NightChapter | null = null
  for (const chapter of chapters) {
    if (chapter.start <= time) found = chapter
    else break
  }
  return found ?? chapters[0] ?? null
}

export function clock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00"
  const whole = Math.floor(seconds)
  const hours = Math.floor(whole / 3600)
  const minutes = Math.floor((whole % 3600) / 60)
  const secs = whole % 60
  const ss = String(secs).padStart(2, "0")
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, "0")}:${ss}`
  return `${minutes}:${ss}`
}

// Decimal megabytes, so 60,000,000 bytes is 60 MB, matching the size quoted for an hour of audio.
export function storedMegabytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "0 MB"
  const mb = bytes / 1_000_000
  return mb >= 10 ? `${Math.round(mb)} MB` : `${mb.toFixed(1)} MB`
}

function whole(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0
}

function chapterOk(value: unknown): value is NightChapter {
  if (!value || typeof value !== "object") return false
  const chapter = value as NightChapter
  return typeof chapter.courseId === "string" && chapter.courseId.length > 0
    && typeof chapter.courseTitle === "string"
    && whole(chapter.number)
    && typeof chapter.title === "string"
    && typeof chapter.start === "number" && Number.isFinite(chapter.start) && chapter.start >= 0
}

export function parseBuildState(value: unknown): NightBuildState | null {
  if (!value || typeof value !== "object") return null
  const body = value as { state?: unknown; done?: unknown; total?: unknown; key?: unknown; bytes?: unknown; duration?: unknown; chapters?: unknown; error?: unknown }
  if (body.state === "checking") return { state: "checking" }
  if (body.state === "building" && whole(body.done) && whole(body.total)) return { state: "building", done: body.done, total: body.total }
  if (body.state === "failed" && typeof body.error === "string" && body.error.length > 0) {
    return { state: "failed", error: body.error, done: whole(body.done) ? body.done : 0, total: whole(body.total) ? body.total : 0 }
  }
  if (body.state !== "ready" || typeof body.key !== "string" || !/^[0-9a-f]{64}$/.test(body.key)) return null
  // A ready recording has a real length. Nought bytes is a recording with nothing in it.
  if (typeof body.bytes !== "number" || !Number.isInteger(body.bytes) || body.bytes <= 0) return null
  if (typeof body.duration !== "number" || !Number.isFinite(body.duration) || body.duration < 0) return null
  if (!Array.isArray(body.chapters) || !body.chapters.every(chapterOk)) return null
  return { state: "ready", key: body.key, bytes: body.bytes, duration: body.duration, chapters: body.chapters }
}

export function parsePlace(raw: string | null): NightPlace | null {
  if (!raw) return null
  try {
    const value: unknown = JSON.parse(raw)
    if (!value || typeof value !== "object" || Array.isArray(value)) return null
    const place = value as { key?: unknown; seconds?: unknown; bytes?: unknown; chapters?: unknown }
    if (typeof place.key !== "string" || !/^[0-9a-f]{64}$/.test(place.key)) return null
    if (typeof place.seconds !== "number" || !Number.isFinite(place.seconds) || place.seconds < 0) return null
    const chapters = Array.isArray(place.chapters) && place.chapters.every(chapterOk) ? place.chapters : []
    const bytes = typeof place.bytes === "number" && Number.isFinite(place.bytes) && place.bytes >= 0 ? place.bytes : 0
    return { key: place.key, seconds: place.seconds, bytes, chapters }
  } catch {
    // A damaged value is the same as no place: Play starts at the beginning.
    return null
  }
}

export function placeRecord(place: NightPlace): string {
  return JSON.stringify(place)
}

export type NightManifest = { duration: number; chapters: NightChapter[] }

export function manifestRecord(key: string, manifest: NightManifest): string {
  return JSON.stringify({ version: MANIFEST_VERSION, hash: key, duration: manifest.duration, chapters: manifest.chapters })
}

// A manifest is read only when it is this version, for this script, and whole. Anything else,
// a damaged file included, means the recording is built again.
export function parseManifest(text: string, key: string): NightManifest | null {
  try {
    const value: unknown = JSON.parse(text)
    if (!value || typeof value !== "object" || Array.isArray(value)) return null
    const body = value as { version?: unknown; hash?: unknown; duration?: unknown; chapters?: unknown }
    if (body.version !== MANIFEST_VERSION || body.hash !== key) return null
    if (typeof body.duration !== "number" || !Number.isFinite(body.duration) || body.duration < 0) return null
    if (!Array.isArray(body.chapters) || !body.chapters.every(chapterOk)) return null
    return { duration: body.duration, chapters: body.chapters }
  } catch {
    // A manifest cut short by a crash is the same as no manifest: the build runs again.
    return null
  }
}

/** The page's line about the Mac when it cannot be reached. */
export function offlineLine(remote: Extract<NightRemote, { state: "offline" }>, stored: boolean): string {
  const reach = remote.total > 0
    ? `The Mac is not answering. The recording had reached ${remote.done} of ${remote.total}.`
    : "The Mac cannot be reached."
  return stored ? `${reach} Play uses the recording on this device.` : `${reach} This device has no recording yet.`
}

export type NightWatchDeps = {
  status: (retry: boolean) => Promise<unknown>
  stored: () => boolean
  show: (remote: NightRemote) => void
  later: (run: () => void, ms: number) => number
  cancel: (handle: number) => void
  now: () => number
}

// Asks the Mac for the build status and keeps asking while keepWatching says so. One check runs
// at a time: Try again cancels the waiting one, and an answer to an older check is ignored.
export function createNightWatch(deps: NightWatchDeps): { look: (retry: boolean) => Promise<void>; stop: () => void } {
  let live = true
  let timer: number | null = null
  let run = 0
  let watched: NightRemote["state"] | null = null
  let firstMiss: number | null = null
  let progress = { done: 0, total: 0 }

  const again = () => {
    timer = deps.later(() => {
      timer = null
      void look(false)
    }, STATUS_GAP_MS)
  }

  const look = async (retry: boolean) => {
    if (!live) return
    if (timer !== null) deps.cancel(timer)
    timer = null
    const mine = ++run
    if (retry) {
      firstMiss = null
      if (watched === "building") deps.show({ state: "building", ...progress })
    }
    let body: unknown
    try {
      body = await deps.status(retry)
    } catch {
      // No answer, or one that is not JSON: counted as a miss, and the page says so once the misses run out.
      if (!live || mine !== run) return
      firstMiss ??= deps.now()
      const missedFor = deps.now() - firstMiss
      const going = keepWatching(watched, deps.stored(), missedFor)
      if (!going || watched !== "building") deps.show({ state: "offline", ...progress })
      if (going) again()
      return
    }
    if (!live || mine !== run) return
    firstMiss = null
    const parsed = parseBuildState(body)
    if (!parsed) {
      watched = "failed"
      deps.show({ state: "failed", error: "The Mac sent a recording status this page cannot read.", done: 0, total: 0 })
      return
    }
    watched = parsed.state
    if (parsed.state === "building") progress = { done: parsed.done, total: parsed.total }
    deps.show(parsed)
    if (keepWatching(watched, deps.stored(), null)) again()
  }

  const stop = () => {
    live = false
    if (timer !== null) deps.cancel(timer)
    timer = null
  }

  return { look, stop }
}

// A refusal the page explains in its own words. Other errors are the connection's or the device's.
export class StoreRefused extends Error {}

/**
 * Reads the recording as it arrives, refusing it the moment it passes the length the Mac named and
 * when it ends short of it.
 */
export async function readStore(body: ReadableStream<Uint8Array>, expected: number, progress: (got: number) => void): Promise<Blob> {
  const reader = body.getReader()
  const chunks: BlobPart[] = []
  let total = 0
  for (;;) {
    const step = await reader.read()
    if (step.done) break
    if (total + step.value.byteLength > expected) {
      void reader.cancel().catch(() => {
        // The oversize body is already refused. Closing the stream is best effort.
      })
      throw new StoreRefused("The recording is larger than the Mac described, so it was not stored.")
    }
    chunks.push(step.value as BlobPart)
    total += step.value.byteLength
    progress(total)
  }
  if (total !== expected) throw new StoreRefused("The recording stopped before it was complete. Try again.")
  return new Blob(chunks, { type: "audio/mp4" })
}

/** The sentence the page shows when a store fails. */
export function storeProblem(error: unknown): string {
  if (error instanceof StoreRefused) return error.message
  if (error instanceof DOMException && (error.name === "TimeoutError" || error.name === "AbortError")) {
    return "The recording took more than five minutes to arrive, so it was not stored. Try again on a faster connection."
  }
  if (error instanceof TypeError || (error instanceof DOMException && error.name === "NetworkError")) {
    return "The Mac stopped sending the recording. Try again."
  }
  return "This device could not keep the recording. Free some space and try again."
}

export type Seekable = {
  readyState: number
  currentTime: number
  addEventListener(type: "loadedmetadata", listener: () => void, options: { once: true }): void
}

// Setting the time before the audio knows its length can throw, so it waits for the metadata.
export function seekWhenReady(media: Seekable, seconds: number) {
  const seek = () => {
    media.currentTime = seconds
  }
  if (media.readyState >= 1) seek()
  else media.addEventListener("loadedmetadata", seek, { once: true })
}

export type RangeResult = { kind: "all" } | { kind: "partial"; start: number; end: number } | { kind: "unsatisfiable" }

// One byte range, as an audio element asks for it. No header means the whole file.
export function byteRange(header: string | null, size: number): RangeResult {
  if (header == null || header.trim() === "") return { kind: "all" }
  if (!Number.isInteger(size) || size < 0) return { kind: "unsatisfiable" }
  const match = /^bytes=(\d*)-(\d*)/.exec(header.trim())
  if (!match) return { kind: "unsatisfiable" }
  const startText = match[1] ?? ""
  const endText = match[2] ?? ""
  if (startText === "" && endText === "") return { kind: "unsatisfiable" }
  if (startText === "") {
    const suffix = Number(endText)
    if (!Number.isInteger(suffix) || suffix <= 0) return { kind: "unsatisfiable" }
    const length = Math.min(suffix, size)
    if (length === 0) return { kind: "unsatisfiable" }
    return { kind: "partial", start: size - length, end: size - 1 }
  }
  const start = Number(startText)
  if (!Number.isInteger(start) || start < 0 || start >= size) return { kind: "unsatisfiable" }
  const end = endText === "" ? size - 1 : Math.min(Number(endText), size - 1)
  if (!Number.isInteger(end) || end < start) return { kind: "unsatisfiable" }
  return { kind: "partial", start, end }
}

function ascii(data: Uint8Array, start: number, end: number): string {
  let out = ""
  for (let index = start; index < end; index += 1) out += String.fromCharCode(data[index] ?? 0)
  return out
}

function wavView(data: Uint8Array): DataView {
  return new DataView(data.buffer, data.byteOffset, data.byteLength)
}

function writeText(target: Uint8Array, offset: number, value: string) {
  for (let index = 0; index < value.length; index += 1) target[offset + index] = value.charCodeAt(index)
}

// The sound of one `say` WAV. `say` puts an extra filler chunk before the sound, so the chunk
// list is read rather than a fixed header. Only the Mac's 16-bit mono 22050 Hz files join.
export function pcmOf(wav: Uint8Array): Uint8Array {
  if (wav.length < 12 || ascii(wav, 0, 4) !== "RIFF" || ascii(wav, 8, 12) !== "WAVE") throw new Error("not a wav")
  const view = wavView(wav)
  let format: { rate: number; channels: number; bits: number } | null = null
  let data: Uint8Array | null = null
  let offset = 12
  while (offset + 8 <= wav.length) {
    const id = ascii(wav, offset, offset + 4)
    const size = view.getUint32(offset + 4, true)
    const start = offset + 8
    if (start + size > wav.length) throw new Error("a wav chunk runs past the end")
    if (id === "fmt ") {
      if (size < 16) throw new Error("wav format is too short")
      if (view.getUint16(start, true) !== 1) throw new Error("wav is not pcm")
      format = { channels: view.getUint16(start + 2, true), rate: view.getUint32(start + 4, true), bits: view.getUint16(start + 14, true) }
    } else if (id === "data") data = wav.slice(start, start + size)
    offset = start + size + (size % 2)
  }
  if (!format || format.channels !== 1 || format.rate !== WAV_RATE || format.bits !== 16) throw new Error("wav is not 16-bit mono at 22050 Hz")
  if (!data) throw new Error("wav has no sound")
  if (data.length % 2 !== 0) throw new Error("wav sound is cut short")
  return data
}

export function wavFromPcm(pcm: Uint8Array): Uint8Array {
  const wav = new Uint8Array(44 + pcm.length)
  const view = wavView(wav)
  writeText(wav, 0, "RIFF")
  view.setUint32(4, 36 + pcm.length, true)
  writeText(wav, 8, "WAVE")
  writeText(wav, 12, "fmt ")
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, WAV_RATE, true)
  view.setUint32(28, WAV_RATE * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeText(wav, 36, "data")
  view.setUint32(40, pcm.length, true)
  wav.set(pcm, 44)
  return wav
}

export function pcmDuration(bytes: number): number {
  return bytes / (WAV_RATE * 2)
}

export function joinWavs(wavs: Uint8Array[]): { wav: Uint8Array; durations: number[] } {
  const pcms = wavs.map((wav) => pcmOf(wav))
  const durations = pcms.map((pcm) => pcmDuration(pcm.length))
  const joined = new Uint8Array(pcms.reduce((sum, pcm) => sum + pcm.length, 0))
  let offset = 0
  for (const pcm of pcms) {
    joined.set(pcm, offset)
    offset += pcm.length
  }
  return { wav: wavFromPcm(joined), durations }
}
