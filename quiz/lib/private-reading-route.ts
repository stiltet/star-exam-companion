import { activePack } from "./pack.ts"
import { isPrivateReadingInput, savePrivateReading } from "./private-reading.ts"
import { readJsonBody } from "./body.ts"
import { sameOrigin } from "./origin.ts"
import { wrongExam } from "./exam-guard.ts"

const MAX_PRIVATE_BODY_BYTES = 8 * 1024 * 1024
const REQUEST_KEYS = ["pageId", "template", "text", "title"]

export async function postPrivateReading(request: Request): Promise<Response> {
  const contentType = request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase()
  if (!sameOrigin(request) || contentType !== "application/json") return Response.json({ ok: false }, { status: 400 })
  const pack = activePack()
  const wrong = wrongExam(request, pack.meta.id)
  if (wrong) return wrong
  const body: unknown = await readJsonBody(request, MAX_PRIVATE_BODY_BYTES)
  if (!body || typeof body !== "object" || Array.isArray(body)) return Response.json({ ok: false }, { status: 400 })
  const data = body as Record<string, unknown>
  const template = data.template
  if (
    Object.keys(data).length !== REQUEST_KEYS.length ||
    !REQUEST_KEYS.every((key) => Object.hasOwn(data, key)) ||
    typeof template !== "string" ||
    !/^\d+$/.test(template) ||
    !isPrivateReadingInput(data)
  ) return Response.json({ ok: false }, { status: 400 })
  const course = pack.courses.find((entry) => entry.provider === "private" && entry.template === template)
  if (!course) return Response.json({ ok: false }, { status: 400 })
  const saved = await savePrivateReading(pack.meta.id, course.id, data)
  return Response.json({ ok: true, pageId: saved.pageId })
}
