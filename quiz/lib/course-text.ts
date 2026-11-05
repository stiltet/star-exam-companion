import { bundleUrl, coursePageUrl, pageList, PARTS, readingIds, riseUrl, type Bundle } from "./reading.ts"
import type { Course, PageSummary } from "./reading-view.ts"
import { decodeRise, riseBundle } from "./rise.ts"

// Each course's bundle, read from Google at most once a day per running quiz. The text is
// Google's, so the Mac keeps it in memory only, never on its disk; only its spoken clips are
// cached, in their own pool (READING_POOL in say.ts). The owner's phone stores the rendered
// reading pages in its service worker, so they open offline.
const DAY_MS = 24 * 60 * 60 * 1000
// After a failure, the next attempt waits this long: a Google outage must not make every page
// load wait for a 15 s timeout.
export const RETRY_MS = 5 * 60 * 1000
// A course never read before that fails is remembered this long: the next request answers at once
// instead of waiting for another timeout, and Try again soon reaches Google again.
export const FAILED_MS = 30 * 1000

type Entry = { at: number; bundle: Bundle; pages: PageSummary[]; ids: string[]; idsAt: number }

export type Loaded = { ok: true; bundle: Bundle; pages: PageSummary[]; ids: string[] } | { ok: false; error: string }

const cache = new Map<string, Entry>()
const failed = new Map<string, { at: number; error: string }>()
// One load per course at a time: pages opened together share it instead of each asking Google.
const loading = new Map<string, Promise<Loaded>>()

// For tests: forget every course, as a restarted quiz would.
export function clearCourseCache(): void {
  cache.clear()
  loading.clear()
  failed.clear()
}

async function part(course: Course, name: (typeof PARTS)[number]): Promise<Bundle[typeof name]> {
  const response = await fetch(bundleUrl(course, name), { cache: "no-store", signal: AbortSignal.timeout(15_000) })
  if (!response.ok) throw new Error(`Google answered ${response.status} for ${name}.json`)
  // No size cap: the host and paths are fixed (Google's own course bucket), never user input.
  const data: unknown = await response.json()
  if (!Array.isArray(data)) throw new Error(`${name}.json is not a list`)
  return data
}

// A course's text as the reader's four lists: its four JSON files, or one Rise file turned into them.
async function bundleOf(course: Course): Promise<Bundle> {
  if (course.format === "rise") {
    const response = await fetch(riseUrl(course), { cache: "no-store", signal: AbortSignal.timeout(30_000) })
    if (!response.ok) throw new Error(`Google answered ${response.status} for runtime-data.js`)
    return riseBundle(decodeRise(await response.text()))
  }
  const [contentObjects, articles, blocks, components] = await Promise.all(PARTS.map((name) => part(course, name)))
  return { contentObjects: contentObjects!, articles: articles!, blocks: blocks!, components: components! }
}

// The readings' ids on Google Skills, for the review links; none when the page cannot be read,
// and then each review button goes to the course instead and says so.
async function ids(course: Course): Promise<string[]> {
  try {
    const response = await fetch(coursePageUrl(course), { cache: "no-store", signal: AbortSignal.timeout(15_000) })
    return response.ok ? readingIds(await response.text(), course) : []
  } catch {
    // Safe to drop: no ids means the course-page fallback, and the ids are asked for again later.
    return []
  }
}

function loaded(entry: Entry): Loaded {
  return { ok: true, bundle: entry.bundle, pages: entry.pages, ids: entry.ids }
}

// Two packs may list the same Skills number with different bundles, so the folder is part of the key.
function key(course: Course): string {
  return `${course.template}:${course.folder}`
}

async function load(course: Course, kept: Entry | undefined): Promise<Loaded> {
  try {
    const [found, bundle] = await Promise.all([ids(course), bundleOf(course)])
    const now = Date.now()
    const entry: Entry = { at: now, bundle, pages: pageList(bundle), ids: found, idsAt: now }
    cache.set(key(course), entry)
    failed.delete(key(course))
    return loaded(entry)
  } catch (error) {
    if (kept) {
      // A stale copy beats none: Google's bucket being down should not silence a course read
      // yesterday. Try again after RETRY_MS, not on every request.
      kept.at = Date.now() - DAY_MS + RETRY_MS
      return loaded(kept)
    }
    const reason = error instanceof Error ? error.message : String(error)
    failed.set(key(course), { at: Date.now(), error: reason })
    return { ok: false, error: reason }
  }
}

// The course's bundle, its readings and their ids on Google Skills, or why it could not be read.
export async function courseBundle(course: Course): Promise<Loaded> {
  const kept = cache.get(key(course))
  const now = Date.now()
  if (kept && now - kept.at < DAY_MS) {
    // A course page that failed once is asked again after RETRY_MS, not kept empty for a day.
    if (kept.ids.length === 0 && now - kept.idsAt >= RETRY_MS) {
      kept.idsAt = now
      kept.ids = await ids(course)
    }
    return loaded(kept)
  }
  const recent = kept ? undefined : failed.get(key(course))
  if (recent && now - recent.at < FAILED_MS) return { ok: false, error: recent.error }
  let run = loading.get(key(course))
  if (!run) {
    run = load(course, kept).finally(() => loading.delete(key(course)))
    loading.set(key(course), run)
  }
  return run
}
