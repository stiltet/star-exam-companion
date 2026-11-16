// pnpm reading:prune [<exam>|all] [--dry-run]
//
// Removes the saved copy of every lesson that Google Skills no longer lists, judged by the manifest of the last finished crawl. No browser
// and no lesson text: only titles and counts. `reading:crawl` runs this itself at the end of every run that was not stopped, so it is
// needed on its own only to check or tidy without crawling. --dry-run lists what would go and removes nothing.
import { listPacks, loadPack, repoRoot } from "../lib/pack.ts"
import { pruneCourse } from "../lib/reading-prune.ts"

const args = process.argv.slice(2)
const target = args.find((arg) => !arg.startsWith("--")) ?? "all"
const dryRun = args.includes("--dry-run")
const root = repoRoot()
const known = listPacks(root).map((entry) => entry.id)
if (target !== "all" && !known.includes(target)) {
  console.error(`Usage: pnpm reading:prune [<exam>|all] [--dry-run]. Known exams: ${known.join(", ")}.`)
  process.exit(2)
}

let total = 0
for (const examId of known.filter((id) => target === "all" || id === target)) {
  for (const course of loadPack(root, examId).courses.filter((entry) => entry.provider === "private")) {
    const result = await pruneCourse(examId, course.id, { dryRun })
    const label = `${examId} ${course.id}. ${course.title}`
    if (result.skipped) {
      console.log(`${label}: skipped, ${result.skipped}.`)
      continue
    }
    total += result.removed.length
    console.log(`${label}: ${result.removed.length === 0 ? "nothing to remove" : `${dryRun ? "would remove" : "removed"} ${result.removed.length}`}.`)
    for (const title of result.removed) console.log(`  ${title}`)
  }
}
console.log(`${dryRun ? "Would remove" : "Removed"} ${total} saved lesson(s) in all.`)
