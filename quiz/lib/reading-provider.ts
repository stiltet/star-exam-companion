import { cleanLessonText } from "./lesson-text.ts"
import { courseBundle as loadGoogleCourse } from "./course-text.ts"
import type { Loaded } from "./course-text.ts"
import type { Course } from "./reading-view.ts"
import { pageList, type Bundle } from "./reading.ts"
import { PrivateRecordError, privateReadingRoot, readPrivateReadings } from "./private-reading.ts"
import { LISTING_VERSION, manifestFile, readManifest, textHash } from "./reading-crawl.ts"

export interface ReadingProvider {
  load(course: Course): Promise<Loaded>
}

export const googleReadingProvider: ReadingProvider = {
  load: loadGoogleCourse,
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>]/g, (character) => {
    if (character === "&") return "&amp;"
    if (character === "<") return "&lt;"
    return "&gt;"
  })
}

// videos: the page ids of the course's video lessons. A video lesson is its title and a video stop, so Read Aloud gives it the same
// button as a video in a public reading; no transcript is kept.
function privateBundle(records: Awaited<ReturnType<typeof readPrivateReadings>>, videos: Set<string> = new Set()): Bundle {
  const bundle: Bundle = { contentObjects: [], articles: [], blocks: [], components: [] }
  records.forEach((record, index) => {
    const article = `${record.pageId}-article`
    const block = `${record.pageId}-block`
    bundle.contentObjects.push({ _id: record.pageId, _type: "page", _sortOrder: index, title: record.title })
    bundle.articles.push({ _id: article, _parentId: record.pageId, _sortOrder: 0 })
    bundle.blocks.push({ _id: block, _parentId: article, _sortOrder: 0 })
    bundle.components.push({
      _id: `${record.pageId}-text`,
      _parentId: block,
      _sortOrder: 0,
      _component: "text",
      body: cleanLessonText(record.text).split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => `<p>${escapeHtml(line)}</p>`).join(""),
    })
    if (videos.has(record.pageId)) bundle.components.push({ _id: `${record.pageId}-video`, _parentId: block, _sortOrder: 1, _component: "videoStream" })
  })
  return bundle
}

export const privateReadingProvider: ReadingProvider = {
  async load(course) {
    try {
      const records = await readPrivateReadings(course.packId, course.id)
      const manifest = await readManifest(manifestFile(privateReadingRoot(), course.packId, course.id)).catch(() => null)
      const bundle = privateBundle(records, new Set((manifest?.lessons ?? []).filter((lesson) => lesson.kind === "video").map((lesson) => lesson.pageId)))
      // No ids: a private page's id is made by the capture, not by Google, so a link built from it would not exist.
      return { ok: true, bundle, pages: pageList(bundle), ids: [] }
    } catch (error) {
      // One damaged file must not take down the Read Aloud overview or the offline worker; the message names no text.
      return {
        ok: false,
        error: error instanceof Error ? error.message : "The private copies could not be read.",
        problem: error instanceof PrivateRecordError ? "record" : "folder",
      }
    }
  },
}

export function courseBundle(course: Course): Promise<Loaded> {
  return (course.provider === "private" ? privateReadingProvider : googleReadingProvider).load(course)
}

// True only when every private course given is fully and consistently captured: its crawl manifest is current, and matches the saved readings one for one (a lesson with no saved text has no reading and does not block). A caller that deletes something derived from the readings (a spoken clip) asks this
// first, so a reading missing from a crawl that is still running is never taken for an unused one. A public course needs no crawl. Any
// doubt, an error included, answers false. It cannot see a crawl that is running between two writes: no lock exists to ask.
export async function crawlCompleteFor(courses: readonly Pick<Course, "id" | "packId" | "provider">[]): Promise<boolean> {
  try {
    for (const course of courses) {
      if (course.provider !== "private") continue
      const manifest = await readManifest(manifestFile(privateReadingRoot(), course.packId, course.id))
      if (!manifest || manifest.listing !== LISTING_VERSION || manifest.lessons.length === 0) return false
      const records = await readPrivateReadings(course.packId, course.id)
      // A lesson with no saved text (an empty or unreadable one) has no reading and so no clip: it must have no record, and it does not block.
      const saved = manifest.lessons.filter((lesson) => lesson.hash !== null)
      if (records.length !== saved.length) return false
      for (const record of records) {
        const lesson = saved.find((item) => item.pageId === record.pageId)
        if (!lesson || lesson.hash !== textHash(record.text)) return false
      }
    }
    return true
  } catch {
    // Dropping the error is safe: false only means "not sure", which makes the caller delete nothing.
    return false
  }
}
