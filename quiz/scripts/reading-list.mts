// pnpm --dir quiz reading:list <exam>
//
// Prints each private course of the exam and which of its lessons are saved, compared with the manifest the last
// `reading:crawl` kept. It needs no browser and reads no lesson text: only titles, counts and addresses.
import { listPacks, loadPack, repoRoot } from "../lib/pack.ts"
import { privateReadingRoot, readPrivateReadings } from "../lib/private-reading.ts"
import { manifestFile, readManifest } from "../lib/reading-crawl.ts"

const exam = process.argv.slice(2).find((arg) => !arg.startsWith("--"))
const root = repoRoot()
const known = listPacks(root).map((entry) => entry.id)
if (!exam || !known.includes(exam)) {
  console.error(`Usage: pnpm --dir quiz reading:list <exam>. Known exams: ${known.join(", ")}.`)
  process.exit(2)
}

const courses = loadPack(root, exam).courses.filter((course) => course.provider === "private")
if (courses.length === 0) console.log(`Exam ${exam}: nothing to capture (no private courses).`)

for (const course of courses) {
  const saved = await readPrivateReadings(exam, course.id)
  const savedIds = new Set(saved.map((record) => record.pageId))
  const manifest = await readManifest(manifestFile(privateReadingRoot(), exam, course.id))
  console.log(`${course.id}. ${course.title}: ${saved.length} lesson(s) saved.`)
  if (!manifest) {
    console.log("  No manifest yet: run reading:crawl first to list the lessons.")
    continue
  }
  const listed = manifest.lessons
  const missing = listed.filter((lesson) => !savedIds.has(lesson.pageId))
  const strangers = saved.filter((record) => !listed.some((lesson) => lesson.pageId === record.pageId))
  console.log(`  Manifest from ${manifest.checkedAt}: ${listed.length} lesson(s) listed, ${listed.length - missing.length} saved.`)
  listed.forEach((lesson, index) => console.log(`  ${String(index + 1).padStart(2)}. ${savedIds.has(lesson.pageId) ? "saved  " : "MISSING"} ${lesson.title}`))
  if (strangers.length > 0) console.log(`  Saved but not in the manifest: ${strangers.map((record) => record.title).join(", ")}.`)
}
