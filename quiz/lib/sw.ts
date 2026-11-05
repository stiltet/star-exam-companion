import { sitePages } from "./pages.ts"

// What the service worker stores on install: every page, study section and topic, each Practice
// filter the pages link to, and every static file of this build.

// Night reading's stored audio. Kept across builds, like the voice clips: a new quiz build must
// not delete a recording the phone already holds.

export const NIGHT_CACHE = "quiz-night"

// meta: the exam this install serves, as pack.json gives it.
export function pageList(sections: { id: string; topics: { id: string }[] }[], practiceSections: string[], meta: { reading: boolean; exam: { questions: number; minutes: number } }): string[] {
  const pages = ["/", ...sitePages(meta).map((page) => page.href), "/about", ...(meta.reading ? ["/read/night"] : []), "/practice?unanswered=1"]
  for (const id of practiceSections) {
    pages.push(`/practice?section=${encodeURIComponent(id)}`)
    pages.push(`/practice?section=${encodeURIComponent(id)}&unanswered=1`)
  }
  for (const section of sections) {
    pages.push(`/study/${encodeURIComponent(section.id)}`)
    for (const topic of section.topics) {
      pages.push(`/study/${encodeURIComponent(section.id)}/${encodeURIComponent(topic.id)}`)
      pages.push(`/practice?topic=${encodeURIComponent(topic.id)}`)
      pages.push(`/practice?topic=${encodeURIComponent(topic.id)}&unanswered=1`)
    }
  }
  return [...new Set(pages)]
}

// Read Aloud's pages: the overview, each course's list and each reading, so they open offline.
// A course whose readings Google did not send (pages null) stores its list only.
export function readingPages(courses: { id: string; pages: { id: string }[] | null }[]): string[] {
  const pages = ["/read"]
  for (const course of courses) {
    pages.push(`/read/${encodeURIComponent(course.id)}`)
    for (const page of course.pages ?? []) pages.push(`/read/${encodeURIComponent(course.id)}/${encodeURIComponent(page.id)}`)
  }
  return pages
}

// Each course's readings for the worker. A course that answers before `late` sends its list, kept
// in `last`; a late or failed one reuses what it last sent, so the worker's bytes stay the same and
// the phone does not install it all again. One never loaded sends null: its list page only.
// `last` is keyed by the course's Skills number (template) when it has one, since two exams both number
// their courses from 1.
export async function coursePages<C extends { id: string; template?: string }, P extends { id: string }>(
  courses: readonly C[],
  load: (course: C) => Promise<{ ok: true; pages: P[] } | { ok: false }>,
  late: Promise<null>,
  last: Map<string, P[]>,
): Promise<{ id: string; pages: P[] | null }[]> {
  return Promise.all(courses.map(async (course) => {
    const loaded = await Promise.race([load(course), late])
    const key = course.template ?? course.id
    if (loaded?.ok) last.set(key, loaded.pages)
    return { id: course.id, pages: last.get(key) ?? null }
  }))
}

// URL paths for files under a directory, given their paths relative to it.
export function staticList(files: string[], prefix: string): string[] {
  return files.map((file) => `${prefix}/${file.split("/").map(encodeURIComponent).join("/")}`)
}

// The worker source with its settings in front. JSON is a valid JavaScript expression.
export function workerScript(config: { build: string; pages: string[]; statics: string[] }, worker: string): string {
  return `const CONFIG = ${JSON.stringify(config)};\n${worker}`
}
