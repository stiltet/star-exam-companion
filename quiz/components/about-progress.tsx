"use client"

import { useSnapshot } from "@/components/snapshot"
import { answeredIds, examHistory, flashcardProgress, modeLines, readingProgress } from "@/lib/progress"

// Where the exam preparation stands, read on this device from the Mac's copy and the answers not yet sent.
// Nothing here is written into the project: it is the owner's own answers, shown to the owner.
export function AboutProgress() {
  const { snapshot, lines, from } = useSnapshot()
  if (!snapshot) {
    return <p className="text-muted-foreground text-sm">{from === "loading" ? "Loading…" : "Progress shows here when the quiz runs on your own Mac."}</p>
  }
  const questions = snapshot.items.length
  const voice = answeredIds(modeLines(lines, "round")).size
  const practice = answeredIds(modeLines(lines, "practice")).size
  const exams = examHistory(lines)
  const best = exams.length > 0 ? Math.max(...exams.map((exam) => exam.percent)) : null
  const cards = flashcardProgress(snapshot.terms ?? [], lines)
  const lessons = Object.values(readingProgress(lines)).reduce((sum, course) => sum + course.read.length, 0)
  const rows: [string, string][] = [
    ["Practice exams taken", exams.length === 0 ? "None yet" : `${exams.length} · best ${best}%`],
    ["Voice Quiz answered", `${voice} of ${questions}`],
    ["Practice answered", `${practice} of ${questions}`],
    ["Flashcards known", `${cards.known} of ${cards.total}`],
    ["Lessons read aloud", String(lessons)],
  ]
  return (
    <table className="w-full text-sm">
      <tbody>
        {rows.map(([label, value], index) => (
          <tr key={label} className={index === rows.length - 1 ? "" : "border-b border-foreground"}>
            <th scope="row" className="py-3 pr-2 text-left font-normal text-muted-foreground">{label}</th>
            <td className="py-3 text-right font-bold whitespace-nowrap">{value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
