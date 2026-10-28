import { NextResponse } from "next/server"
import { loadPlay } from "@/lib/load"
import { browserOrigin, REFUSED_ORIGIN } from "@/lib/origin"
import type { Snapshot } from "@/lib/snapshot"
import { voiceKeys } from "@/lib/speak"

export const dynamic = "force-dynamic"

const NO_STORE = { "Cache-Control": "no-store" }

// Everything the device keeps for offline use: the questions, the plan's sections and the saved lines.
export async function GET(request: Request) {
  // The scores are private: only a page on one of this Mac's names may read them.
  if (browserOrigin(request) === REFUSED_ORIGIN) return NextResponse.json({ ok: false }, { status: 400, headers: NO_STORE })
  const play = loadPlay()
  if (!play.ok) return NextResponse.json({ ok: false, row: play.row, error: play.error }, { status: 409, headers: NO_STORE })
  const snapshot: Snapshot = {
    items: play.items,
    terms: play.glossary.terms.map((term) => term.term),
    namesChecked: play.glossary.namesChecked,
    sections: play.sections,
    lines: play.lines,
    skippedLines: play.skippedLines,
    voice: voiceKeys(play.items),
  }
  return NextResponse.json({ ok: true, snapshot }, { headers: NO_STORE })
}
