// A request from a page of another exam than the Mac serves now is refused with 409 and the exam served,
// so its answers are neither checked against the wrong exam nor deleted from the device. A request that
// names no exam, from a page older than this check, is let through as before unless its caller
// supplies the exam those older pages belong to.
export function wrongExam(request: Request, served: string, legacyExam?: string): Response | null {
  const sent = request.headers.get("x-quiz-exam") ?? legacyExam
  if (sent === undefined || sent === served) return null
  return Response.json({ ok: false, wrongExam: served }, { status: 409, headers: { "Cache-Control": "no-store" } })
}
