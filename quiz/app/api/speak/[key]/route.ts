import { NextResponse } from "next/server"
import { loadVoiceIndex } from "@/lib/load"
import { browserOrigin, REFUSED_ORIGIN } from "@/lib/origin"
import { clipFor } from "@/lib/say"

// A line the quiz can say, by the SHA-256 of its text, so the phone can keep the clip for offline
// rounds. Any other key is a 404: this route never speaks a text it did not write itself.
export async function GET(request: Request, { params }: { params: Promise<{ key: string }> }) {
  if (browserOrigin(request) === REFUSED_ORIGIN) return NextResponse.json({ ok: false }, { status: 400 })
  const { key } = await params
  if (!/^[0-9a-f]{64}$/.test(key)) return NextResponse.json({ ok: false }, { status: 404 })
  const text = loadVoiceIndex()?.get(key)
  if (text === undefined) return NextResponse.json({ ok: false }, { status: 404 })
  const clip = await clipFor(text)
  if (!clip) return NextResponse.json({ ok: false }, { status: 500 })
  // The key is the text's hash, so the clip for a key never changes.
  return new NextResponse(new Uint8Array(clip), { headers: { "Content-Type": "audio/wav", "Cache-Control": "private, max-age=31536000, immutable" } })
}
