import { readJsonBody } from "./body.ts"
import { sameOrigin } from "./origin.ts"
import { startNightPreload } from "./night-preload.ts"
import { setActiveExam } from "./pack.ts"

// Switches the exam this install serves, for every device. Like Reset, only a page on one of this Mac's own
// names may ask, and it must name a pack that is in exams/.
// onSwitched: what runs after a successful switch (the new exam's Night recording starts); a test passes its own.
// The route handler is postExam below, which takes only the request, as Next calls it with a second argument of its own.
export async function switchExam(request: Request, onSwitched: () => void): Promise<Response> {
  if (!sameOrigin(request) || request.headers.get("content-type") !== "application/json") return Response.json({ ok: false }, { status: 400 })
  const body = await readJsonBody(request)
  const exam = body && typeof body === "object" && !Array.isArray(body) && Object.keys(body).length === 1 ? (body as { exam?: unknown }).exam : undefined
  if (typeof exam !== "string" || !setActiveExam(exam)) return Response.json({ ok: false }, { status: 400 })
  // The new exam's Night reading recording starts building now, not when its page is first opened.
  onSwitched()
  return Response.json({ ok: true, exam })
}

export function postExam(request: Request): Promise<Response> {
  return switchExam(request, startNightPreload)
}
