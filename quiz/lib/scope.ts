// What one exam keeps in the browser (queued answers, the saved snapshot, a half-finished exam) is
// named after the exam, so switching an install to another exam on the same address never sends one
// exam's answers to another, and a stored item says which exam it belongs to. Client-safe: no Node
// imports.

export const DEFAULT_EXAM = "generative-ai-leader"

// The exam this page belongs to, written on <html> by the server for each request (app/layout.tsx).
// A page keeps its own exam: a copy the worker stored before a switch still reads its own keys.
function onHtml(name: string): string | undefined {
  return typeof document === "undefined" ? undefined : document.documentElement.dataset[name]
}

export function currentExam(): string {
  return onHtml("exam") || DEFAULT_EXAM
}

export function scoped(name: string, exam: string = currentExam()): string {
  return `${name}-${exam}`
}

// Before the names carried the exam, the Generative AI Leader quiz kept these under plain names.
const LEGACY_NAMES = [
  "quiz-outbox",
  "quiz-rejected",
  "quiz-rejected-reasons",
  "quiz-snapshot",
  "quiz-snapshot-at",
  "quiz-snapshot-refreshed",
  "quiz-exam",
  "quiz-flashcards",
  "quiz-reading-totals",
]
const LEGACY_PRACTICE = "quiz-practice:"

type Store = Pick<Storage, "length" | "key" | "getItem" | "setItem" | "removeItem">

function queued(text: string | null): { id?: unknown }[] | null {
  try {
    const value: unknown = text === null ? null : JSON.parse(text)
    return Array.isArray(value) ? value : null
  } catch {
    // Not JSON, so not a queue: the caller treats it as none and keeps the other copy.
    return null
  }
}

function keyed(text: string | null): Record<string, unknown> | null {
  try {
    const value: unknown = text === null ? null : JSON.parse(text)
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null
  } catch {
    // Not JSON, so not a map: the caller keeps the other copy.
    return null
  }
}

// A copy the app cannot read is not deleted: it is kept under `<name>-unreadable`, as the scores move keeps a backup.
// A different unreadable text already kept there is not overwritten: the next free `-2`, `-3`... holds it, and the
// same text is kept once.
function keepUnreadable(store: Store, name: string, text: string): void {
  for (let n = 1; ; n += 1) {
    const backup = n === 1 ? `${name}-unreadable` : `${name}-unreadable-${n}`
    const kept = store.getItem(backup)
    if (kept === text) return
    if (kept === null) {
      store.setItem(backup, text)
      return
    }
  }
}

// The default exam takes its old plain-named items over once, so nothing studied before is lost:
// every queued answer still reaches the Mac. If both names hold a queue or the refused answers and their
// reasons (an older open page wrote the plain one after this ran), they merge by answer id, the newer
// scoped copy winning. For anything else the scoped copy, the newer, is kept. Another exam never touches them.
export function migrateLegacyStorage(store: Store, exam: string = currentExam()): void {
  if (exam !== DEFAULT_EXAM) return
  const moves: [string, string][] = LEGACY_NAMES.map((name) => [name, scoped(name, exam)])
  for (let index = 0; index < store.length; index += 1) {
    const key = store.key(index)
    if (key?.startsWith(LEGACY_PRACTICE)) moves.push([key, `${scoped("quiz-practice", exam)}:${key.slice(LEGACY_PRACTICE.length)}`])
  }
  for (const [from, to] of moves) {
    const old = store.getItem(from)
    if (old === null) continue
    const current = store.getItem(to)
    if (current === null) {
      // Nothing under the scoped name yet: the plain copy is adopted as it is. One the app cannot read is kept too.
      if ((from === "quiz-outbox" || from === "quiz-rejected") && !queued(old)) keepUnreadable(store, to, old)
      if (from === "quiz-rejected-reasons" && !keyed(old)) keepUnreadable(store, to, old)
      store.setItem(to, old)
    } else if (from === "quiz-outbox" || from === "quiz-rejected") {
      // A copy that is not a list holds nothing to send: the other copy is adopted, so no queued answer is
      // stranded under a name the app no longer reads. The unreadable text is kept under a backup name.
      const first = queued(current)
      const second = queued(old)
      if (!first) keepUnreadable(store, to, current)
      if (!second) keepUnreadable(store, to, old)
      const seen = new Set((first ?? []).map((item) => item.id))
      store.setItem(to, JSON.stringify([...(first ?? []), ...(second ?? []).filter((item) => !seen.has(item.id))]))
    } else if (from === "quiz-rejected-reasons") {
      const first = keyed(current)
      const second = keyed(old)
      if (!first) keepUnreadable(store, to, current)
      if (!second) keepUnreadable(store, to, old)
      store.setItem(to, JSON.stringify({ ...(second ?? {}), ...(first ?? {}) }))
    }
    store.removeItem(from)
  }
}

// Runs once, when the first client module loads, before any of them reads a key.
if (typeof window !== "undefined") {
  try {
    migrateLegacyStorage(window.localStorage)
  } catch {
    // Storage blocked: the quiz still works, with nothing carried over.
  }
}
