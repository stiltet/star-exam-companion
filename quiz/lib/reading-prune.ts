import { describeError } from "./debug-log.ts"
import { deletePrivateReading, privateReadingRoot, readPrivateReadings, type PrivateReadingRecord } from "./private-reading.ts"
import { LISTING_VERSION, manifestFile, readManifest, type Manifest } from "./reading-crawl.ts"

// A saved copy is stale when the manifest of a finished crawl no longer lists its page. The crawl keeps the id of a copy it matched by
// title, so a lesson that is still listed is never stale, whatever tool saved it first.
export function staleRecords(saved: PrivateReadingRecord[], manifest: Manifest): PrivateReadingRecord[] {
  const listed = new Set(manifest.lessons.map((lesson) => lesson.pageId))
  return saved.filter((record) => !listed.has(record.pageId))
}

export type PruneResult = {
  // Titles of the saved copies removed (or, with dryRun, that would be removed). Titles only, never text.
  removed: string[]
  // Why nothing was considered, when the course's manifest cannot be trusted to say what Google no longer lists.
  skipped?: string
}

// Removes the saved copies of lessons the course no longer lists. It trusts only a manifest that is complete (a run finished the whole
// course from a settled listing), that was made under today's listing rule, and that lists at least one lesson: anything else could make every copy look gone.
export async function pruneCourse(examId: string, courseId: string, options: { dryRun?: boolean } = {}): Promise<PruneResult> {
  const manifest = await readManifest(manifestFile(privateReadingRoot(), examId, courseId))
  if (!manifest) return { removed: [], skipped: "no manifest yet: run pnpm reading:crawl first" }
  if (manifest.complete === undefined) return { removed: [], skipped: "the manifest was made before automatic pruning existed: run pnpm reading:crawl once to refresh it" }
  if (manifest.complete !== true) return { removed: [], skipped: "the last crawl of this course did not finish, its lesson list was still changing, or a card could not be read: run pnpm reading:crawl first" }
  if (manifest.listing !== LISTING_VERSION) return { removed: [], skipped: "the manifest was made under an older listing rule: run pnpm reading:crawl first" }
  if (manifest.lessons.length === 0) return { removed: [], skipped: "the course lists no lessons" }
  // An entry without a page id would match nothing, so every saved copy would look gone.
  if (!manifest.lessons.every((lesson) => typeof lesson.pageId === "string" && lesson.pageId !== "")) return { removed: [], skipped: "the manifest has an entry with no page id: run pnpm reading:crawl to rewrite it" }
  const stale = staleRecords(await readPrivateReadings(examId, courseId), manifest)
  if (!options.dryRun) for (const record of stale) await deletePrivateReading(examId, courseId, record.pageId)
  return { removed: stale.map((record) => record.title) }
}

export type PrunedCourse = { examId: string; courseId: string; removed: string[]; skipped?: string; error?: string }

// Prunes each course of a finished crawl. A course whose prune throws is reported with its error and the others still run, so one bad
// course never hides the rest. The prune function is a parameter so a failure can be tested.
export async function pruneFinishedCourses(courses: { examId: string; courseId: string }[], prune: typeof pruneCourse = pruneCourse): Promise<PrunedCourse[]> {
  const done: PrunedCourse[] = []
  for (const { examId, courseId } of courses) {
    try {
      const result = await prune(examId, courseId)
      done.push({ examId, courseId, removed: result.removed, skipped: result.skipped })
    } catch (error) {
      // Not dropped: the error goes into this course's entry, which the crawl prints in red, logs and turns into a non-zero exit.
      done.push({ examId, courseId, removed: [], error: describeError(error) })
    }
  }
  return done
}
