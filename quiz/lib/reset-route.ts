import path from "node:path"
import { readJsonBody } from "./body.ts"
import { wrongExam } from "./exam-guard.ts"
import { DEFAULT_EXAM } from "./scope.ts"
import { loadPlay, scoresFile } from "./load.ts"
import { browserOrigin, sameOrigin } from "./origin.ts"
import { acceptReset, resetScores } from "./reset.ts"

// Empties the exam's scores after copying them to scores-backups/. A page of another exam than the Mac serves is
// refused first, so it can never empty the scores of the exam being studied now.
export async function postReset(request: Request): Promise<Response> {
  if (!sameOrigin(request)) return Response.json({ ok: false }, { status: 400 })
  const play = loadPlay()
  if (!play.ok) return Response.json({ ok: false }, { status: 400 })
  // A page older than the exam header belongs to the default exam, so it can never empty another exam's scores.
  const wrong = wrongExam(request, play.pack.meta.id, DEFAULT_EXAM)
  if (wrong) return wrong
  const accepted = acceptReset({
    origin: request.headers.get("origin"),
    contentType: request.headers.get("content-type"),
    body: await readJsonBody(request),
    allowedOrigin: browserOrigin(request),
  })
  if (!accepted) return Response.json({ ok: false }, { status: 400 })
  const backup = resetScores(scoresFile(play.root, play.pack.meta.id), new Date(), play.pack.meta.id)
  // No commit here. Scores and their backups are personal and gitignored.
  return Response.json({ ok: true, backup: backup ? path.relative(play.root, backup) : null })
}
