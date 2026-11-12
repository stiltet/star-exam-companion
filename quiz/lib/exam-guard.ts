import { DEFAULT_EXAM } from "./scope.ts"

// A request from a page of another exam than the Mac serves now is refused with 409 and the exam served,
// so its answers are neither checked against the wrong exam nor deleted from the device. A request that
// names no exam comes from a page older than this check. Before exams the quiz served only the default
// exam, so such a page belongs to it: it passes while the default exam is served and is refused otherwise.
// Every route gets this from here, so none can let an older page reach another exam's data.
export function wrongExam(request: Request, served: string): Response | null {
  const sent = request.headers.get("x-quiz-exam") ?? DEFAULT_EXAM
  if (sent === served) return null
  return Response.json({ ok: false, wrongExam: served }, { status: 409, headers: { "Cache-Control": "no-store" } })
}
