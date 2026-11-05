import { wrongExam } from "./exam-guard.ts"
import { DEFAULT_EXAM } from "./scope.ts"
import { loadPlay } from "./load.ts"
import { browserOrigin, REFUSED_ORIGIN } from "./origin.ts"
import type { Snapshot } from "./snapshot.ts"
import { voiceKeys } from "./speak.ts"

const NO_STORE = { "Cache-Control": "no-store" }

// Everything the device keeps for offline use: the questions, the plan's sections and the saved lines. A page of
// another exam than the Mac serves is refused, so it never stores another exam's snapshot under its own keys.
export async function getSnapshot(request: Request): Promise<Response> {
  // The scores are private: only a page on one of this Mac's names may read them.
  if (browserOrigin(request) === REFUSED_ORIGIN) return Response.json({ ok: false }, { status: 400, headers: NO_STORE })
  const play = loadPlay()
  if (!play.ok) return Response.json({ ok: false, row: play.row, error: play.error }, { status: 409, headers: NO_STORE })
  // A page older than the exam header belongs to the default exam: it must not store another exam's snapshot under
  // the plain names, which the default exam later takes over as its own.
  const wrong = wrongExam(request, play.pack.meta.id, DEFAULT_EXAM)
  if (wrong) return wrong
  const snapshot: Snapshot = {
    items: play.items,
    terms: play.glossary.terms.map((term) => term.term),
    namesChecked: play.glossary.namesChecked,
    sections: play.sections,
    lines: play.lines,
    skippedLines: play.skippedLines,
    voice: voiceKeys(play.items),
  }
  return Response.json({ ok: true, snapshot }, { headers: NO_STORE })
}
