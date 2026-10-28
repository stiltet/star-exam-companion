import { EXAM_SECONDS, MAX_EXAM_QUESTIONS } from "./score.ts"

// What a finished exam saved: the questions asked and missed, and since 27 Oct the option chosen
// per answered question and the flagged ones.
export type SavedExam = { asked: string[]; missed: string[]; answers?: Record<string, number>; flagged?: string[] }

export type ReviewStatus = "right" | "wrong" | "unanswered"

// One question of a finished exam. chosen: the option picked, null when left blank, undefined
// when the exam was saved before answers were kept. gone: no longer in the question bank.
export type ReviewRow = { number: number; id: string; status: ReviewStatus; chosen: number | null | undefined; flagged: boolean; gone: boolean }

export type ReviewFilter = "all" | "wrong" | "flagged" | "unanswered"

export function reviewRows(bank: ReadonlyMap<string, { correctIndex: number }>, exam: SavedExam): ReviewRow[] {
  const missed = new Set(exam.missed)
  const flagged = new Set(exam.flagged ?? [])
  return exam.asked.map((id, index) => {
    const chosen = exam.answers ? (exam.answers[id] ?? null) : undefined
    const status: ReviewStatus = !missed.has(id) ? "right" : chosen === null ? "unanswered" : "wrong"
    return { number: index + 1, id, status, chosen, flagged: flagged.has(id), gone: !bank.has(id) }
  })
}

// "wrong" is every missed question, shown as Missed: wrong and unanswered both cost the mark.
export function filterRows(rows: ReviewRow[], filter: ReviewFilter): ReviewRow[] {
  if (filter === "wrong") return rows.filter((row) => row.status !== "right")
  if (filter === "flagged") return rows.filter((row) => row.flagged)
  if (filter === "unanswered") return rows.filter((row) => row.status === "unanswered")
  return rows
}

// The questions a retake asks: every one missed or flagged that is still in the bank.
export function retakeIds(exam: SavedExam, bank: ReadonlySet<string>): string[] {
  const pick = new Set([...exam.missed, ...(exam.flagged ?? [])])
  return exam.asked.filter((id) => pick.has(id) && bank.has(id))
}

// The full exam's time per question, for any number of questions (at least one).
export function examDuration(count: number): number {
  const questions = Math.min(MAX_EXAM_QUESTIONS, Math.max(1, count))
  return Math.round((EXAM_SECONDS / MAX_EXAM_QUESTIONS) * questions)
}

// A review lives in the /exam page's hash, so it opens offline from the stored page.
export function reviewHash(id: string): string {
  return `#review=${encodeURIComponent(id)}`
}

export function reviewId(hash: string): string | null {
  const match = /^#review=(.+)$/.exec(hash)
  if (!match?.[1]) return null
  try {
    return decodeURIComponent(match[1])
  } catch {
    // A hand-typed hash that is not valid percent-encoding names no exam.
    return null
  }
}

// Fisher–Yates: every order equally likely, unlike sort(() => Math.random() - 0.5).
export function shuffle<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const mixed = [...items]
  for (let i = mixed.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[mixed[i], mixed[j]] = [mixed[j] as T, mixed[i] as T]
  }
  return mixed
}
