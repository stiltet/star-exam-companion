import { appendFileSync } from "node:fs"
import { loadPlay, readScores, scoresFile } from "./load.ts"
import { readJsonBody } from "./body.ts"
import { browserOrigin, sameOrigin } from "./origin.ts"
import { acceptBatch, storeAnswers } from "./score.ts"
import { wrongExam } from "./exam-guard.ts"
import { DEFAULT_EXAM } from "./scope.ts"
import { practiceItems, writtenPool } from "./questions.ts"

const MAX_BATCH_BYTES = 1024 * 1024

export async function postScores(request: Request): Promise<Response> {
  if (!sameOrigin(request)) return Response.json({ ok: false }, { status: 400 })
  const body = await readJsonBody(request, MAX_BATCH_BYTES)
  const play = loadPlay()
  if (!play.ok) return Response.json({ ok: false }, { status: 400 })
  // A page older than the exam header can only belong to the default exam, the one exam the quiz had before packs.
  // Checked as that exam, so after a switch its queued answers are refused (and kept on the device), never marked gone.
  const wrong = wrongExam(request, play.pack.meta.id, DEFAULT_EXAM)
  if (wrong) return wrong
  const decision = acceptBatch({
    origin: request.headers.get("origin"),
    contentType: request.headers.get("content-type"),
    body,
    allowedOrigin: browserOrigin(request),
    bankIds: new Set(practiceItems(play.items, writtenPool(play.bank)).map((item) => item.id)),
    roundIds: new Set(play.items.map((item) => item.id)),
    termNames: new Set(play.glossary.terms.map((term) => term.term)),
    examLength: play.pack.meta.exam,
    courseIds: play.pack.courses.map((course) => course.id),
    now: Date.now(),
  })
  if (!decision.ok) return Response.json({ ok: false }, { status: 400 })
  // No await between read and append: concurrent requests cannot both store one ID.
  const file = scoresFile(play.root, play.pack.meta.id)
  const result = storeAnswers(readScores(file).lines, decision.answers)
  if (result.lines.length > 0) appendFileSync(file, result.lines.map((line) => `${JSON.stringify(line)}\n`).join(""))
  // Scores stay local: quiz/scores-<exam>.jsonl is gitignored.
  return Response.json({ ok: true, stored: result.stored, duplicate: result.duplicate, rejected: decision.rejected, gone: decision.gone, reasons: decision.reasons })
}
