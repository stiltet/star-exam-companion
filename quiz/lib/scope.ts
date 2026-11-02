// What one exam keeps in the browser (queued answers, the saved snapshot, a half-finished exam) is
// named after the exam, so switching an install to another exam on the same address never sends one
// exam's answers to another, and a stored item says which exam it belongs to. Client-safe: no Node
// imports.

export const DEFAULT_EXAM = "generative-ai-leader"

// Baked in at build time from QUIZ_EXAM (next.config.mjs), since the browser cannot read the server's environment.
export const BUILT_EXAM = process.env.NEXT_PUBLIC_QUIZ_EXAM || DEFAULT_EXAM

// Whether this exam's pack has the course reading feature (pack.json "reading"), also baked in at build time.
export const BUILT_READING = process.env.NEXT_PUBLIC_QUIZ_READING !== "0"

// The Practice exam's length, from pack.json "exam", baked in at build time. The defaults are Generative AI Leader's.
export const BUILT_EXAM_QUESTIONS = Number(process.env.NEXT_PUBLIC_QUIZ_EXAM_QUESTIONS) || 60
export const BUILT_EXAM_MINUTES = Number(process.env.NEXT_PUBLIC_QUIZ_EXAM_MINUTES) || 90

export function scoped(name: string, exam: string = BUILT_EXAM): string {
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
export function migrateLegacyStorage(store: Store, exam: string = BUILT_EXAM): void {
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
