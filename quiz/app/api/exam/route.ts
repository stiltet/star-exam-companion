import { NextResponse } from "next/server"
import { readJsonBody } from "@/lib/body"
import { sameOrigin } from "@/lib/origin"
import { setActiveExam } from "@/lib/pack"

// Switches the exam this install serves, for every device. Like Reset, only a page on one of this
// Mac's own names may ask, and it must name a pack that is in exams/.
export async function POST(request: Request) {
  if (!sameOrigin(request) || request.headers.get("content-type") !== "application/json") return NextResponse.json({ ok: false }, { status: 400 })
  const body = await readJsonBody(request)
  const exam = body && typeof body === "object" && !Array.isArray(body) && Object.keys(body).length === 1 ? (body as { exam?: unknown }).exam : undefined
  if (typeof exam !== "string" || !setActiveExam(exam)) return NextResponse.json({ ok: false }, { status: 400 })
  return NextResponse.json({ ok: true, exam })
}
