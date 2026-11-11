import { cleanLessonText } from "./lesson-text.ts"
import { courseBundle as loadGoogleCourse } from "./course-text.ts"
import type { Loaded } from "./course-text.ts"
import type { Course } from "./reading-view.ts"
import { pageList, type Bundle } from "./reading.ts"
import { PrivateRecordError, readPrivateReadings } from "./private-reading.ts"

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

function privateBundle(records: Awaited<ReturnType<typeof readPrivateReadings>>): Bundle {
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
  })
  return bundle
}

export const privateReadingProvider: ReadingProvider = {
  async load(course) {
    try {
      const records = await readPrivateReadings(course.packId, course.id)
      const bundle = privateBundle(records)
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
