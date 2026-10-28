import { PRACTICE_TARGET, voiceProgress, type RoundItem, type ScoreLine } from "./learn.ts"
import { takeRound } from "./round.ts"

// Each mode reads only its own lines, so practice or an exam never changes a Voice Quiz round.
export function modeLines(lines: ScoreLine[], mode: string): ScoreLine[] {
  return lines.filter((line) => line.mode === mode)
}

// The questions still to learn, exam section by exam section from 1 to 4.
// Inside a section the order stays shuffled; the sort is stable, so it keeps the shuffle.
// A question with no exam section stays at the end.
export function voiceRound(items: RoundItem[], lines: ScoreLine[], random: () => number = Math.random): RoundItem[] {
  const rank = (item: RoundItem) => (item.section > 0 ? item.section : Number.MAX_SAFE_INTEGER)
  return [...takeRound(items, modeLines(lines, "round"), random)].sort((a, b) => rank(a) - rank(b))
}

// Where a question sits for the title: its exam section, and its number among that section's
// questions in this round. Null when the question has no section, and null past the end.
export function sectionPosition(round: { section?: number }[], index: number): { section: number; number: number; count: number } | null {
  const section = round[index]?.section
  if (!section) return null
  const same = (other: { section?: number }) => other.section === section
  return { section, number: round.slice(0, index + 1).filter(same).length, count: round.filter(same).length }
}

// The quiz's name for a learning-path course. A course has no share of the exam.
export function courseLabel(id: number | string): string {
  return `Course ${id}`
}

// The quiz's name for an exam-guide section, with that section's share of the exam.
// The tilde is the exam guide's own mark that the share is approximate.
export function sectionLabel(id: number | string, weight: number): string {
  return `Section ${id} (~${weight}%)`
}

// The first question of the exam section before this one, and of the section after. Null at
// either end, and null when this question has no section. A gap still jumps to the nearest section.
export function sectionJump(round: { section?: number }[], index: number): { previous: number | null; next: number | null } {
  const current = round[index]?.section
  if (!current) return { previous: null, next: null }
  let previousSection = -Infinity
  let nextSection = Infinity
  for (const item of round) {
    const section = item.section ?? 0
    if (section < current && section > previousSection) previousSection = section
    if (section > current && section < nextSection) nextSection = section
  }
  return {
    previous: previousSection === -Infinity ? null : round.findIndex((item) => item.section === previousSection),
    next: nextSection === Infinity ? null : round.findIndex((item) => item.section === nextSection),
  }
}

type Sections = { id: number; title: string; weight: number }[]

export function practiceProgress(items: Pick<RoundItem, "id" | "section">[], lines: ScoreLine[], sections: Sections) {
  return voiceProgress(items, modeLines(lines, "practice"), sections)
}

// Every question answered at least once, in any mode: a Practice or Voice Quiz line is one
// answer; an exam counts the questions it saved an answer for, or, before 27 Oct, when no answers
// were saved, the ones it got right. Practice's Unanswered filter leaves these out (owner, 28 Oct).
export function answeredIds(lines: ScoreLine[]): Set<string> {
  const ids = new Set<string>()
  for (const line of lines) {
    if (line.mode === "exam") {
      const missed = new Set(line.missed)
      const answered = line.answers ? Object.keys(line.answers) : line.asked.filter((id) => !missed.has(id))
      for (const id of answered) ids.add(id)
    } else if (line.mode === "practice" || line.mode === "round") {
      for (const id of line.asked) ids.add(id)
    }
  }
  return ids
}

// What the Progress page shows for a mode: how much of the quiz is answered, and how much is
// right out of all its questions, so the gap to the target is to the whole quiz.
export function progressFigures(progress: { total: number; asked: number; correct: number }) {
  const percent = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0)
  const correctOfAll = percent(progress.correct, progress.total)
  return {
    total: progress.total,
    answered: progress.asked,
    answeredPercent: percent(progress.asked, progress.total),
    correctOfAnswered: percent(progress.correct, progress.asked),
    correctOfAll,
    gap: Math.max(0, PRACTICE_TARGET - correctOfAll),
  }
}

// One finished exam. id, answers and flagged are there only on lines that saved them; without
// an id it cannot be opened for review.
export type ExamResult = {
  date: string
  total: number
  correct: number
  percent: number
  seconds: number
  id?: string
  asked: string[]
  missed: string[]
  answers?: Record<string, number>
  flagged?: string[]
  retake?: true
}

// Practice exams by default; "retake" lists the retakes of missed and flagged questions, which
// do not count as practice exams; "all" both, to find any one for review. An exam with no
// question answered was only a test and is left out (owner, 28 Oct). A line from before 27 Oct
// saved no answers, so there no right answer stands for none answered. The line stays saved.
export function examHistory(lines: ScoreLine[], kind: "exam" | "retake" | "all" = "exam"): ExamResult[] {
  return modeLines(lines, "exam")
    .filter((line) => kind === "all" || (kind === "retake") === (line.retake === true))
    .filter((line) => (line.answers ? Object.keys(line.answers).length > 0 : line.missed.length < line.asked.length))
    .map((line) => {
      const total = line.asked.length
      const correct = total - line.missed.length
      return {
        date: line.date,
        total,
        correct,
        percent: total > 0 ? Math.round((correct / total) * 100) : 0,
        seconds: line.seconds ?? 0,
        ...(line.id ? { id: line.id } : {}),
        asked: line.asked,
        missed: line.missed,
        ...(line.answers ? { answers: line.answers } : {}),
        ...(line.flagged ? { flagged: line.flagged } : {}),
        ...(line.retake ? { retake: true as const } : {}),
      }
    })
    .reverse()
}

// The readings read in Read Aloud, per course: each page once, and the last day one was read.
// A line asks "<course>/<page>".
export function readingProgress(lines: ScoreLine[]): Record<string, { read: string[]; last: string }> {
  const out: Record<string, { read: string[]; last: string }> = {}
  for (const line of modeLines(lines, "reading")) {
    for (const reading of line.asked) {
      // A hand-edited line may hold anything; only "<course>/<page>" counts.
      if (typeof reading !== "string" || !reading.includes("/")) continue
      const [course = "", page = ""] = reading.split("/")
      if (!course || !page) continue
      const entry = (out[course] ??= { read: [], last: line.date })
      if (!entry.read.includes(page)) entry.read.push(page)
      if (line.date > entry.last) entry.last = line.date
    }
  }
  return out
}

// Done, in progress or not started, for the course's colour on the Read Aloud list.
export function readingState(read: number, total: number | undefined): "done" | "progress" | "none" {
  if (read === 0) return "none"
  return total !== undefined && total > 0 && read >= total ? "done" : "progress"
}

// A course's state in Read Aloud, as its lists and Progress show it. A reading Google later
// drops still counts in the saved lines, so the count never goes past the total.
export function readingStatus(read: number, total: number | undefined): string {
  if (read === 0) return total !== undefined && total > 0 ? `Not started · 0 of ${total}` : "Not started"
  if (total === undefined || total <= 0) return `In progress · ${read} read`
  return read >= total ? `✓ Done · ${total} of ${total}` : `In progress · ${read} of ${total}`
}

// Whether MARK AS READ, or the voice reaching the end, should save now: not when this page saved
// it today (savedOn) or a saved line already says so. A failed save leaves savedOn unset, so a
// retry saves; a new day saves again.
export function needsSaving(lines: ScoreLine[], reading: string, date: string, savedOn: string | null): boolean {
  return savedOn !== date && !readToday(lines, reading, date)
}

// Whether a reading was already saved as read on this day: it is saved once a day at most.
export function readToday(lines: ScoreLine[], reading: string, date: string): boolean {
  return modeLines(lines, "reading").some((line) => line.date === date && line.asked.includes(reading))
}

// The latest mark per glossary term decides whether it is known.
export function flashcardProgress(terms: string[], lines: ScoreLine[]): { total: number; marked: number; known: number } {
  const latest = new Map<string, boolean>()
  for (const line of modeLines(lines, "flashcard")) {
    for (const term of line.asked) latest.set(term, !line.missed.includes(term))
  }
  const own = terms.filter((term) => latest.has(term))
  return { total: terms.length, marked: own.length, known: own.filter((term) => latest.get(term)).length }
}
