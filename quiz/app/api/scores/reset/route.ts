import path from "node:path"
import { NextResponse } from "next/server"
import { loadPlay, scoresFile } from "@/lib/load"
import { readJsonBody } from "@/lib/body"
import { browserOrigin, sameOrigin } from "@/lib/origin"
import { acceptReset, resetScores } from "@/lib/reset"

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ ok: false }, { status: 400 })
  const play = loadPlay()
  if (!play.ok) return NextResponse.json({ ok: false }, { status: 400 })
  const accepted = acceptReset({
    origin: request.headers.get("origin"),
    contentType: request.headers.get("content-type"),
    body: await readJsonBody(request),
    allowedOrigin: browserOrigin(request),
  })
  if (!accepted) return NextResponse.json({ ok: false }, { status: 400 })
  const backup = resetScores(scoresFile(play.root), new Date())
  // No commit here. Scores and their backups are personal and gitignored.
  return NextResponse.json({ ok: true, backup: backup ? path.relative(play.root, backup) : null })
}
