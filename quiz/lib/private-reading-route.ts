import { activePack } from "./pack.ts"
import { PrivateStoreLimitError, isPrivateReadingInput, savePrivateReading } from "./private-reading.ts"
import { readJsonBody } from "./body.ts"
import { sameOrigin } from "./origin.ts"
import { wrongExam } from "./exam-guard.ts"

const MAX_PRIVATE_BODY_BYTES = 8 * 1024 * 1024
const REQUEST_KEYS = ["pageId", "template", "text", "title"]

// A refusal says which kind it was, so the capture tab can tell the person what to do: origin (not this page or not
// JSON), body (not a reading request), reading (empty or too big), template (a course this pack does not save).
function refuse(reason: "origin" | "body" | "reading" | "template"): Response {
  return Response.json({ ok: false, reason }, { status: 400 })
}

export async function postPrivateReading(request: Request): Promise<Response> {
  const contentType = request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase()
  if (!sameOrigin(request) || contentType !== "application/json") return refuse("origin")
  const pack = activePack()
  const wrong = wrongExam(request, pack.meta.id)
  if (wrong) return wrong
  const body: unknown = await readJsonBody(request, MAX_PRIVATE_BODY_BYTES)
  if (!body || typeof body !== "object" || Array.isArray(body)) return refuse("body")
  const data = body as Record<string, unknown>
  const template = data.template
  if (
    Object.keys(data).length !== REQUEST_KEYS.length ||
    !REQUEST_KEYS.every((key) => Object.hasOwn(data, key)) ||
    typeof template !== "string" ||
    !/^\d+$/.test(template)
  ) return refuse("body")
  if (!isPrivateReadingInput(data)) return refuse("reading")
  const course = pack.courses.find((entry) => entry.provider === "private" && entry.template === template)
  if (!course) return refuse("template")
  try {
    const saved = await savePrivateReading(pack.meta.id, course.id, data)
    return Response.json({ ok: true, pageId: saved.pageId })
  } catch (error) {
    if (error instanceof PrivateStoreLimitError) return Response.json({ ok: false, reason: "limit" }, { status: 413 })
    throw error
  }
}
