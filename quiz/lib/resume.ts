import type { Store } from "./outbox.ts"
import { scoped } from "./scope.ts"

// Where each mode left off, kept on the device only. Anything unreadable, or pointing at a
// question or term no longer in the glossary, starts afresh instead of guessing.

export function loadState(store: Store, key: string): unknown {
  try {
    return JSON.parse(store.getItem(key) ?? "null") as unknown
  } catch {
    // A torn value is treated as none.
    return null
  }
}

export function saveState(store: Store & Pick<Storage, "removeItem">, key: string, value: unknown): void {
  try {
    if (value === null) store.removeItem(key)
    else store.setItem(key, JSON.stringify(value))
  } catch {
    // Storage full or blocked: the place is not kept, and every answer is still in the outbox.
  }
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null
}

function choices(value: unknown, ids: ReadonlySet<string>): Record<string, number> {
  const out: Record<string, number> = {}
  for (const [id, choice] of Object.entries(record(value) ?? {})) {
    if (ids.has(id) && Number.isInteger(choice) && (choice as number) >= 0 && (choice as number) < 4) out[id] = choice as number
  }
  return out
}

function names(value: unknown, ids: ReadonlySet<string>): string[] | null {
  if (!Array.isArray(value) || !value.every((id) => typeof id === "string" && ids.has(id))) return null
  return value as string[]
}

export const practiceKey = (filter: string) => `${scoped("quiz-practice")}:${filter}`

export type PracticePlace = { id: string; picked: Record<string, number> }

// The last question and the choices already made, for one Practice filter. Kept, never shown:
// Practice always opens on question 1 with nothing answered (owner, 28 Oct).
export function practicePlace(ids: string[], saved: unknown): { index: number; picked: Record<string, number> } {
  const place = record(saved)
  const index = typeof place?.id === "string" ? ids.indexOf(place.id) : -1
  return { index: Math.max(0, index), picked: choices(place?.picked, new Set(ids)) }
}

export const EXAM_KEY = scoped("quiz-exam")

export type ExamSaved = {
  ids: string[]
  answers: Record<string, number>
  flagged: string[]
  index: number
  state: "active" | "review"
  startedAt: number
  endsAt: number
  // A retake of missed and flagged questions, saved apart from practice exams when it ends.
  retake: boolean
}

export function examResume(saved: unknown, bankIds: ReadonlySet<string>): ExamSaved | null {
  const exam = record(saved)
  if (!exam) return null
  const ids = names(exam.ids, bankIds)
  const flagged = names(exam.flagged, bankIds)
  if (!ids || ids.length === 0 || !flagged) return null
  const { index, state, startedAt, endsAt } = exam
  if (state !== "active" && state !== "review") return null
  if (typeof startedAt !== "number" || typeof endsAt !== "number" || !(endsAt > startedAt)) return null
  if (!Number.isInteger(index) || (index as number) < 0 || (index as number) >= ids.length) return null
  return { ids, answers: choices(exam.answers, new Set(ids)), flagged, index: index as number, state, startedAt, endsAt, retake: exam.retake === true }
}

// Seconds left on the exam clock, which runs on while the app is closed, as in the real exam.
export function secondsLeft(endsAt: number, now: number): number {
  return Math.max(0, Math.ceil((endsAt - now) / 1000))
}

// The exam's line: every question asked, and those answered wrong or left blank as missed.
export function examOutcome(questions: { id: string; correctIndex: number }[], answers: Record<string, number>): { asked: string[]; missed: string[] } {
  return {
    asked: questions.map((question) => question.id),
    missed: questions.filter((question) => answers[question.id] !== question.correctIndex).map((question) => question.id),
  }
}

export function examSeconds(startedAt: number, finishedAt: number, duration: number): number {
  return Math.min(duration, Math.max(0, Math.round((finishedAt - startedAt) / 1000)))
}

export const CARDS_KEY = scoped("quiz-flashcards")

// After a reset every mode starts afresh: the Practice places, the exam and the flashcards.
export function clearDeviceSessions(store: Pick<Storage, "length" | "key" | "removeItem">): void {
  const keys: string[] = []
  for (let index = 0; index < store.length; index += 1) {
    const key = store.key(index)
    if (key && (key.startsWith(practiceKey("")) || key === EXAM_KEY || key === CARDS_KEY)) keys.push(key)
  }
  for (const key of keys) store.removeItem(key)
}

export type CardsSaved = { category: string; order: string[]; index: number; known: string[] }

export function cardsResume(saved: unknown, terms: ReadonlySet<string>): CardsSaved | null {
  const cards = record(saved)
  if (!cards || typeof cards.category !== "string") return null
  const order = names(cards.order, terms)
  const known = names(cards.known, terms)
  if (!order || order.length === 0 || !known) return null
  if (!Number.isInteger(cards.index) || (cards.index as number) < 0 || (cards.index as number) >= order.length) return null
  return { category: cards.category, order, index: cards.index as number, known }
}
