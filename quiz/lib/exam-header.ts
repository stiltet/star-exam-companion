import { currentExam } from "./scope.ts"

// Every request that reads or changes an exam's data says which exam its page belongs to, so a page left
// open on one exam never reads or writes another's after the Mac is switched. Client-safe.
export const EXAM_HEADER = "X-Quiz-Exam"

export function examHeaders(): Record<string, string> {
  return { [EXAM_HEADER]: currentExam() }
}

const RELOADED_KEY = "quiz-exam-reloaded"
const RELOAD_GAP_MS = 15_000

// The Mac refused a request because it now serves another exam. The page is stale, so it reloads once to
// show the exam served; what it queued stays on the device under its own exam. Returns true when it was
// such a refusal. Never reloads twice within a few seconds, whatever the Mac says.
export async function followWrongExam(response: Response): Promise<boolean> {
  if (response.status !== 409) return false
  let served: unknown
  try {
    served = ((await response.clone().json()) as { wrongExam?: unknown }).wrongExam
  } catch {
    // Not a wrong-exam answer: another 409 (a glossary row that cannot be read) is handled by its caller.
    return false
  }
  if (typeof served !== "string") return false
  try {
    const last = Number(window.sessionStorage.getItem(RELOADED_KEY) ?? 0)
    if (served !== currentExam() && Date.now() - last > RELOAD_GAP_MS) {
      window.sessionStorage.setItem(RELOADED_KEY, String(Date.now()))
      window.location.reload()
    }
  } catch {
    // Storage blocked: leave the page as it is; the next visit shows the exam served.
  }
  return true
}
