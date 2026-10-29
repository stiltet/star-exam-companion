import { assignSessions, chronological, type ScoreLine } from "./learn.ts"
import { MAX_BATCH, toLine, type Answer, type Mode } from "./score.ts"

// Every answer is kept on the device first and sent from there, so one given away from home, or
// while the Mac is asleep, reaches quiz/scores.jsonl the next time the app can reach the Mac.
export const OUTBOX_KEY = "quiz-outbox"
// Refused answers stay here until an explicit retry is acknowledged by the Mac.
export const REJECTED_KEY = "quiz-rejected"
const REASONS_KEY = "quiz-rejected-reasons"

export type Store = Pick<Storage, "getItem" | "setItem">

export type SendResult = { stored: string[]; duplicate: string[]; rejected: string[]; gone?: string[]; reasons?: Record<string, string> }
export type SendSummary = { sent: number; waiting: number; rejected: number; reached: boolean; storageError: boolean }

// A version 4 UUID from getRandomValues, which works on plain HTTP; randomUUID needs HTTPS.
export function newId(fill: (bytes: Uint8Array) => Uint8Array = (bytes) => crypto.getRandomValues(bytes)): string {
  const bytes = fill(new Uint8Array(16))
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("")
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export type AnswerExtra = Pick<Answer, "seconds" | "answers" | "flagged" | "retake">

export function newAnswer(mode: Mode, asked: string[], missed: string[], extra: AnswerExtra = {}, now = new Date()): Answer {
  const kept = Object.fromEntries(Object.entries(extra).filter(([, value]) => value !== undefined)) as AnswerExtra
  return { id: newId(), at: now.toISOString(), mode, asked, missed, ...kept }
}

function readList(store: Store, key: string): Answer[] {
  try {
    const value = JSON.parse(store.getItem(key) ?? "[]") as unknown
    return Array.isArray(value) ? (value as Answer[]) : []
  } catch {
    // Unreadable storage counts as empty; the next save writes a fresh list.
    return []
  }
}

function writeList(store: Store, key: string, list: Answer[]): boolean {
  try {
    store.setItem(key, JSON.stringify(list))
    return true
  } catch {
    // Storage full or blocked: the caller sends the answer at once instead.
    return false
  }
}

export function readOutbox(store: Store): Answer[] {
  return readList(store, OUTBOX_KEY)
}

export function readRejected(store: Store): Answer[] {
  return readList(store, REJECTED_KEY)
}

export function readRejectionReasons(store: Store): Record<string, string> {
  try {
    const value: unknown = JSON.parse(store.getItem(REASONS_KEY) ?? "{}")
    if (!value || typeof value !== "object" || Array.isArray(value)) return {}
    return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string"))
  } catch {
    // The UI explicitly says no reason was recorded; the saved answers remain intact.
    return {}
  }
}

export function addToOutbox(store: Store, answer: Answer): boolean {
  return writeList(store, OUTBOX_KEY, [...readOutbox(store), answer])
}

// Sends the waiting answers in batches. An answer leaves the outbox only once the Mac has stored
// it or already had it; a refused one moves to the rejected list. Stops at the first batch the
// Mac does not answer, and keeps the rest for the next try.
export async function sendOutbox(store: Store, post: (answers: Answer[]) => Promise<SendResult | null>, retryRejected = false): Promise<SendSummary> {
  let sent = 0
  let reached = true
  let storageError = false
  const pending = [...new Map([...readOutbox(store), ...(retryRejected ? readRejected(store) : [])].map((answer) => [answer.id, answer])).values()]
  for (let start = 0; start < pending.length; start += MAX_BATCH) {
    const batch = pending.slice(start, start + MAX_BATCH)
    const result = await post(batch)
    if (!result) {
      reached = false
      break
    }
    const requested = new Set(batch.map((answer) => answer.id))
    const done = new Set([...result.stored, ...result.duplicate].filter((id) => requested.has(id)))
    // An answer about a removed question is dropped: no retry can ever store it.
    const gone = new Set((result.gone ?? []).filter((id) => requested.has(id) && !done.has(id)))
    const refused = new Set(result.rejected.filter((id) => requested.has(id) && !done.has(id) && !gone.has(id)))
    // Re-read: an answer may have been added while the batch was on its way.
    const now = readOutbox(store)
    const rejected = [...new Map([...readRejected(store), ...now.filter((answer) => refused.has(answer.id))].map((answer) => [answer.id, answer])).values()].filter((answer) => !done.has(answer.id) && !gone.has(answer.id))
    // Keep the outbox intact if the refused copy cannot be written.
    if (!writeList(store, REJECTED_KEY, rejected)) {
      storageError = true
      break
    }
    if (!writeList(store, OUTBOX_KEY, now.filter((answer) => !done.has(answer.id) && !refused.has(answer.id) && !gone.has(answer.id)))) {
      storageError = true
      break
    }
    const previous = readRejectionReasons(store)
    const reasons = Object.fromEntries(rejected.map((answer) => [
      answer.id,
      refused.has(answer.id)
        ? result.reasons?.[answer.id] ?? "The Mac did not provide a reason. Update the quiz and retry."
        : previous[answer.id] ?? "No reason was recorded. Retry to ask the Mac.",
    ]))
    try {
      store.setItem(REASONS_KEY, JSON.stringify(reasons))
    } catch {
      // Returned to Progress as a storage error, never an all-saved success.
      storageError = true
    }
    sent += done.size
  }
  return { sent, waiting: readOutbox(store).length, rejected: readRejected(store).length, reached, storageError }
}

// The Mac's lines plus the answers still on the device, in answer order, sessions by the shared rule.
export function mergeLines(saved: ScoreLine[], outbox: Answer[]): ScoreLine[] {
  const known = new Set(saved.flatMap((line) => (line.id ? [line.id] : [])))
  const waiting = outbox.filter((answer) => !known.has(answer.id))
  const sessions = assignSessions(saved, waiting)
  return chronological([...saved, ...waiting.map((answer, index) => toLine(answer, sessions[index] ?? 0))])
}
