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
    return null
  }
}

// The default exam takes its old plain-named items over once, so nothing studied before is lost:
// every queued answer still reaches the Mac. If both names hold a queue (an older open page wrote
// the plain one after this ran), the queues merge by answer id. Another exam never touches them.
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
      store.setItem(to, old)
    } else if (from === "quiz-outbox") {
      const first = queued(current)
      const second = queued(old)
      if (first && second) {
        const seen = new Set(first.map((item) => item.id))
        store.setItem(to, JSON.stringify([...first, ...second.filter((item) => !seen.has(item.id))]))
      }
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
