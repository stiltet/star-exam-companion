// What the Back button remembers per history entry, so Back returns to the page just before at the
// scroll it was left at. An entry is one step of the browser's history: the same path visited twice
// is two entries. Each entry is stamped with an id in history.state (which survives a reload), and
// its record lives in sessionStorage under that id.

// The key in history.state that holds the entry's id.
export const ENTRY_STATE_KEY = "__quizEntry"

export const entryKey = (id: string): string => `quiz-entry:${id}`

// prev: the entry this one was opened from, or null when it was opened directly or by going up a level.
export type Entry = { prev: string | null; scroll: number }

export const serialiseEntry = (entry: Entry): string => JSON.stringify(entry)

// A stored entry: a previous entry's id or none, and a whole number of pixels, zero or more.
// Anything else is no entry.
export function parseEntry(raw: string | null): Entry | null {
  if (raw === null) return null
  try {
    const value: unknown = JSON.parse(raw)
    if (typeof value !== "object" || value === null) return null
    const { prev, scroll } = value as { prev?: unknown; scroll?: unknown }
    if (prev !== null && typeof prev !== "string") return null
    if (typeof scroll !== "number" || !Number.isInteger(scroll) || scroll < 0 || scroll > 9_999_999) return null
    return { prev, scroll }
  } catch {
    // Not JSON: nothing this app wrote.
    return null
  }
}

// Where the last entry's id is kept, so a page loaded in full still knows the entry it came from.
export const LAST_ENTRY_KEY = "quiz-last-entry"

// Whether the page was opened from another page of this app. After a full page load, which Next.js
// falls back to when it cannot do a client-side move (offline, with no copy kept), the page no
// longer knows its own history, but the browser still names the page it came from.
export function cameFromApp(referrer: string, origin: string): boolean {
  try {
    return referrer !== "" && new URL(referrer).origin === origin
  } catch {
    // A referrer that is not an address did not come from a page of this app.
    return false
  }
}
