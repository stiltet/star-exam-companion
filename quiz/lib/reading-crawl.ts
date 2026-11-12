import { createHash } from "node:crypto"
import { mkdir, readFile, rename, writeFile } from "node:fs/promises"
import path from "node:path"
import { PRIVATE_PAGE_ID } from "./page-id.ts"

// The logic behind `pnpm reading:crawl`, without a browser: what counts as a lesson, the manifest kept for each course, the
// comparison with the last run, the verdict and the progress line. The command (scripts/reading-crawl.mts) holds the browser.
// No lesson text is ever kept here; the manifest holds titles, addresses and a hash of each saved text.

// A lesson as the course page lists it.
// kind "video": a video lesson. It is saved by its title only (no page is opened, no transcript is read), and Read Aloud gives it
// a button that opens it on Google Skills.
export type Lesson = { title: string; href: string; kind?: "video" }

// What happened to one lesson in this run.
export type Outcome = "saved" | "already" | "empty" | "failed"

export type ManifestLesson = {
  title: string
  href: string
  pageId: string
  kind?: "video"
  // Hash of the saved text. Null while the lesson has no saved text (empty or failed).
  hash: string | null
}

export type Manifest = {
  checkedAt: string
  lessons: ManifestLesson[]
}

// The shortest pause between two pages, and the longest: drawn fresh for each page, uniformly.
export const PAUSE_MIN_MS = 2_000
export const PAUSE_MAX_MS = 15_000

export function randomPauseMs(random: () => number = Math.random): number {
  return Math.round(PAUSE_MIN_MS + random() * (PAUSE_MAX_MS - PAUSE_MIN_MS))
}

export function textHash(text: string): string {
  return createHash("sha256").update(text).digest("hex")
}

// The page id a lesson is saved under: its bundle or document number from the address, so it is the same every run. An address with no
// number gets the first 19 digits of a hash, which fit the store's 1 to 20 digit ids.
export function lessonPageId(href: string): string {
  const match = /\/(?:html_bundles|documents|video)\/(\d{1,20})(?:[/?#]|$)/.exec(href)
  if (match && PRIVATE_PAGE_ID.test(match[1])) return match[1]
  const digits = BigInt(`0x${createHash("sha256").update(href).digest("hex").slice(0, 16)}`).toString().slice(0, 19)
  return digits.replace(/^0+/, "") || "1"
}

export type ManifestComparison = {
  // True when there is no earlier manifest, so there is nothing to compare.
  first: boolean
  added: string[]
  removed: string[]
  reordered: boolean
  addressChanged: string[]
}

// A key per lesson that stays the same between runs even when titles repeat (a course can hold many lessons called "Knowledge
// check"): the title and which time it appears in the list.
function keyed<T extends { title: string }>(items: T[]): { key: string; item: T }[] {
  const seen = new Map<string, number>()
  return items.map((item) => {
    const times = (seen.get(item.title) ?? 0) + 1
    seen.set(item.title, times)
    return { key: `${item.title}\u0000${times}`, item }
  })
}

// Compares the lessons the site lists now with the last manifest, matching by title and, for a repeated title, by its place
// among the lessons of that title.
export function compareLessons(previous: Manifest | null, now: Lesson[]): ManifestComparison {
  if (!previous) return { first: true, added: [], removed: [], reordered: false, addressChanged: [] }
  const before = keyed(previous.lessons)
  const after = keyed(now)
  const beforeByKey = new Map(before.map((entry) => [entry.key, entry.item]))
  const afterKeys = new Set(after.map((entry) => entry.key))
  const added = after.filter((entry) => !beforeByKey.has(entry.key)).map((entry) => entry.item.title)
  const removed = before.filter((entry) => !afterKeys.has(entry.key)).map((entry) => entry.item.title)
  const addressChanged = after
    .filter((entry) => beforeByKey.has(entry.key) && beforeByKey.get(entry.key)!.href !== entry.item.href)
    .map((entry) => entry.item.title)
  const keptBefore = before.filter((entry) => afterKeys.has(entry.key)).map((entry) => entry.key)
  const keptAfter = after.filter((entry) => beforeByKey.has(entry.key)).map((entry) => entry.key)
  const reordered = keptBefore.some((key, index) => key !== keptAfter[index])
  return { first: false, added, removed, reordered, addressChanged }
}

export type CourseResult = {
  listed: number
  saved: number
  already: number
  empty: string[]
  failed: string[]
  // Lessons whose saved text differs from the last manifest (only found when a lesson is read again).
  textChanged: string[]
  // Titles listed by the site that no outcome accounts for.
  unaccounted: string[]
  comparison: ManifestComparison
}

export type Verdict =
  | { kind: "current" }
  | { kind: "changed"; what: string[] }
  | { kind: "incomplete"; what: string[] }

// Listed = saved + already saved + empty + failed, matched by title, and the manifest comparison. A gap is always named.
export function verdict(result: CourseResult): Verdict {
  const problems: string[] = []
  if (result.unaccounted.length > 0) problems.push(`${result.unaccounted.length} listed lesson(s) not accounted for`)
  const counted = result.saved + result.already + result.empty.length + result.failed.length
  if (counted !== result.listed) problems.push(`the site lists ${result.listed} lessons but ${counted} are accounted for`)
  if (result.empty.length > 0) problems.push(`${result.empty.length} lesson(s) had no reading text`)
  if (result.failed.length > 0) problems.push(`${result.failed.length} lesson(s) failed`)
  if (problems.length > 0) return { kind: "incomplete", what: problems }
  const changes: string[] = []
  const { comparison } = result
  if (!comparison.first) {
    if (comparison.added.length > 0) changes.push(`${comparison.added.length} lesson(s) added`)
    if (comparison.removed.length > 0) changes.push(`${comparison.removed.length} lesson(s) removed`)
    if (comparison.reordered) changes.push("lessons reordered")
    if (comparison.addressChanged.length > 0) changes.push(`${comparison.addressChanged.length} lesson address(es) changed`)
  }
  if (result.textChanged.length > 0) changes.push(`${result.textChanged.length} lesson text(s) changed`)
  return changes.length > 0 ? { kind: "changed", what: changes } : { kind: "current" }
}

export function verdictLine(course: string, title: string, value: Verdict): string {
  const head = `Course ${course} (${title}):`
  if (value.kind === "current") return `${head} complete and current.`
  if (value.kind === "changed") return `${head} complete but Google changed: ${value.what.join("; ")}.`
  return `${head} incomplete: ${value.what.join("; ")}.`
}

export type ProgressState = {
  page: number
  total: number
  course: string
  title: string
  // New lessons saved, lessons whose saved text was replaced, lessons already saved and unchanged, lessons with no reading text, failures.
  saved: number
  updated: number
  same: number
  empty: number
  failed: number
  elapsedMs: number
  // Seconds left of the current pause, or null when no pause is running.
  pauseLeft: number | null
}

export type Colour = "green" | "red" | "yellow" | "dim" | "bold"
const CODES: Record<Colour, string> = { green: "32", red: "31", yellow: "33", dim: "2", bold: "1" }

// Wraps text in a terminal colour, or leaves it plain when colour is off (not a terminal, or NO_COLOR is set).
export function paint(colour: Colour, text: string, on: boolean): string {
  return on ? `\x1b[${CODES[colour]}m${text}\x1b[0m` : text
}

export function clock(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1000))
  const minutes = Math.floor(seconds / 60)
  return minutes > 0 ? `${minutes} min ${String(seconds % 60).padStart(2, "0")} s` : `${seconds} s`
}

// Estimated time left: the time per page so far times the pages still to do. Null until one page is done.
export function estimateLeftMs(state: Pick<ProgressState, "page" | "total" | "elapsedMs">): number | null {
  if (state.page < 1) return null
  return (state.elapsedMs / state.page) * (state.total - state.page)
}

function clip(text: string, width: number): string {
  return text.length <= width ? text : `${text.slice(0, Math.max(0, width - 1))}…`
}

// One status line. In a terminal it is redrawn in place (the caller prefixes a carriage return) and the lesson title, which is
// the least important part, is the part that is cut when the line is too wide; otherwise one plain line per page.
export function progressLine(state: ProgressState, tty: boolean, columns = 100, colour = false): string {
  const left = estimateLeftMs(state)
  const time = left === null ? "estimating" : `~${clock(left)} left`
  const label = `${state.page}/${state.total}`
  if (!tty) {
    const counts = `${state.saved} new, ${state.updated} updated, ${state.same} unchanged, ${state.empty} empty, ${state.failed} failed`
    const pause = state.pauseLeft === null ? "" : ` | next page in ${state.pauseLeft} s`
    return `page ${state.page} of ${state.total} | ${state.course} | ${state.title} | ${counts} | ${time}${pause}`
  }
  // The line must never be wider than the terminal, or each redraw wraps onto a new row. Try a roomy layout first, then
  // shorter ones, and cut the lesson title last.
  const failed = `${state.failed} failed`
  const pause = state.pauseLeft === null ? "" : `next page in ${state.pauseLeft} s`
  const layouts = [
    { bar: 16, counts: `${state.saved} new · ${state.updated} updated · ${state.same} same${state.empty > 0 ? ` · ${state.empty} empty` : ""} · `, failed, time, pause },
    { bar: 10, counts: `+${state.saved} ↻${state.updated} =${state.same}${state.empty > 0 ? ` ∅${state.empty}` : ""} `, failed: `✖${state.failed}`, time, pause: pause ? `${state.pauseLeft} s` : "" },
    { bar: 6, counts: "", failed: `✖${state.failed}`, time: left === null ? "" : clock(left), pause: pause ? `${state.pauseLeft} s` : "" },
  ]
  const fits = (layout: (typeof layouts)[number]): number => `${"█".repeat(layout.bar)} ${label}  ${layout.counts}${layout.failed}  ${layout.time}${layout.pause ? `  ${layout.pause}` : ""}`.length
  const chosen = layouts.find((layout) => fits(layout) <= columns) ?? layouts[layouts.length - 1]
  const filled = state.total === 0 ? 0 : Math.round((state.page / state.total) * chosen.bar)
  const bar = `${"█".repeat(filled)}${"░".repeat(chosen.bar - filled)}`
  const room = columns - fits(chosen) - 3
  const title = room >= 10 ? clip(`${state.course}: ${state.title}`, room) : ""
  return [
    paint("green", bar, colour),
    ` ${paint("bold", label, colour)}  ${chosen.counts}`,
    paint(state.failed > 0 ? "red" : "dim", chosen.failed, colour),
    `  ${paint("dim", chosen.time, colour)}`,
    chosen.pause ? paint("yellow", `  ${chosen.pause}`, colour) : "",
    title ? `  ${paint("dim", title, colour)}` : "",
  ].join("")
}

// noLessons is set for a course that lists nothing to read (only labs, videos and quizzes): what it holds instead.
export type CourseSummary = { id: string; title: string; result: CourseResult; noLessons?: string }

function names(list: string[], max = 4): string {
  const unique = [...new Set(list)]
  return unique.length <= max ? unique.join(", ") : `${unique.slice(0, max).join(", ")} and ${unique.length - max} more`
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`
}

// The report at the end of a run: one headline that says plainly whether it finished, then each course on its own short lines
// with a blank line between courses, so a problem stands out. Nothing is wider than the terminal. The headline is FINISHED only
// when every lesson of every course is accounted for; a stop (Ctrl-C, a closed browser) says where it stopped.
export function finalReport(input: { courses: CourseSummary[]; stopped: string | null; page: number; total: number; elapsedMs: number }, colour: boolean, columns = 80): string {
  const lines: string[] = []
  const width = Math.max(20, columns)
  const rule = paint("dim", "─".repeat(Math.min(60, width)), colour)
  const verdicts = input.courses.map((entry) => ({ entry, value: verdict(entry.result) }))
  const bad = verdicts.filter((item) => item.value.kind === "incomplete")
  lines.push(rule)
  if (input.stopped) {
    lines.push(paint("yellow", clip(`■ STOPPED at page ${input.page} of ${input.total}: ${input.stopped}`, width), colour))
    lines.push(paint("dim", clip("  Run it again; it checks every lesson from the start.", width), colour))
  } else if (bad.length > 0) {
    lines.push(paint("red", clip(`✖ NOT FINISHED: ${bad.length} of ${plural(verdicts.length, "course")} incomplete`, width), colour))
  } else {
    lines.push(paint("green", clip(`✔ FINISHED: all ${plural(input.total, "lesson")} checked in ${plural(verdicts.length, "course")}, ${clock(input.elapsedMs)}`, width), colour))
  }
  for (const { entry, value } of verdicts) {
    const { result } = entry
    const updated = result.textChanged.length
    const fresh = Math.max(0, result.saved - updated)
    const unchanged = result.already
    const ok = value.kind !== "incomplete"
    lines.push("")
    if (entry.noLessons !== undefined) {
      // Nothing to read is not a failure: the course is named, with what it holds instead.
      lines.push(`  ${paint("dim", "–", colour)} ${paint("bold", clip(`${entry.id}. ${entry.title}`, width - 4), colour)}`)
      lines.push(paint("dim", clip(`      no readable lessons: ${entry.noLessons}`, width), colour))
      continue
    }
    lines.push(`  ${paint(ok ? "green" : "red", ok ? "✔" : "✖", colour)} ${paint("bold", clip(`${entry.id}. ${entry.title}`, width - 4), colour)}`)
    lines.push(clip(`      ${plural(result.listed, "lesson")}: ${fresh} new, ${updated} updated, ${unchanged} unchanged`, width))
    if (value.kind === "incomplete") {
      if (result.failed.length > 0) lines.push(paint("red", clip(`      ✖ failed: ${names(result.failed)}`, width), colour))
      if (result.empty.length > 0) lines.push(paint("red", clip(`      ✖ no reading text: ${names(result.empty)}`, width), colour))
      for (const what of value.what.filter((text) => !/failed|no reading text/.test(text))) lines.push(paint("red", clip(`      ✖ ${what}`, width), colour))
    }
    const { comparison } = result
    if (!comparison.first) {
      const changes = [
        comparison.added.length ? `${plural(comparison.added.length, "lesson")} added` : "",
        comparison.removed.length ? `${comparison.removed.length} removed` : "",
        comparison.reordered ? "order changed" : "",
        comparison.addressChanged.length ? `${plural(comparison.addressChanged.length, "address")} changed` : "",
      ].filter(Boolean)
      if (changes.length > 0) lines.push(paint("yellow", clip(`      Google changed this course: ${changes.join(", ")}`, width), colour))
    }
  }
  lines.push("")
  lines.push(rule)
  return lines.join("\n")
}

// Where a course's manifest lives: next to its saved readings, outside the repository, never in a build.
export function manifestFile(privateRoot: string, packId: string, course: string): string {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(packId) || !/^\d+$/.test(course)) throw new Error("The manifest needs a valid exam and course id.")
  return path.join(privateRoot, packId, `${course}.manifest.json`)
}

export async function readManifest(file: string): Promise<Manifest | null> {
  let raw: string
  try {
    raw = await readFile(file, "utf8")
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return null
    throw error
  }
  const value = JSON.parse(raw) as Manifest
  if (!value || !Array.isArray(value.lessons) || typeof value.checkedAt !== "string") throw new Error("The manifest file is damaged.")
  return value
}

export async function writeManifest(file: string, manifest: Manifest): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true, mode: 0o700 })
  const temporary = `${file}.${process.pid}.tmp`
  await writeFile(temporary, JSON.stringify(manifest, null, 1), { encoding: "utf8", mode: 0o600 })
  await rename(temporary, file)
}
