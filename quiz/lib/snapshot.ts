import type { RoundItem, ScoreLine } from "./learn.ts"
import { mergeLines, type Store } from "./outbox.ts"
import type { Answer } from "./score.ts"
import { scoped } from "./scope.ts"

// What the device keeps from the Mac, so the Voice Quiz and Progress work with no connection.
export const SNAPSHOT_KEY = scoped("quiz-snapshot")

export type Snapshot = {
  items: RoundItem[]
  terms: string[]
  namesChecked: string | null
  sections: { id: number; title: string; weight: number }[]
  lines: ScoreLine[]
  skippedLines: number
  // Each line the quiz can say, as the page sends it, to the key of its clip on the Mac.
  voice: Record<string, string>
}

export function isSnapshot(value: unknown): value is Snapshot {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const snap = value as Record<string, unknown>
  return (
    Array.isArray(snap.items) &&
    Array.isArray(snap.terms) &&
    Array.isArray(snap.sections) &&
    Array.isArray(snap.lines) &&
    typeof snap.voice === "object" &&
    snap.voice !== null &&
    typeof snap.skippedLines === "number"
  )
}

export function readSnapshot(store: Store): Snapshot | null {
  try {
    const value = JSON.parse(store.getItem(SNAPSHOT_KEY) ?? "null") as unknown
    return isSnapshot(value) ? value : null
  } catch {
    // A torn copy is treated as none; the next visit at home fetches a fresh one.
    return null
  }
}

export function writeSnapshot(store: Store, snapshot: Snapshot): void {
  try {
    store.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot))
  } catch {
    // Storage full: the pages still work online, from the Mac.
  }
}

// Answers the Mac has just taken join the kept copy, so they stay counted until the next fetch.
export function absorbSent(snapshot: Snapshot, sent: Answer[]): Snapshot {
  return { ...snapshot, lines: mergeLines(snapshot.lines, sent) }
}
