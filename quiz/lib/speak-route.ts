import { readJsonBody } from "./body.ts"
import { browserOrigin, sameOrigin } from "./origin.ts"
import { clipFor, type Pool } from "./say.ts"
import { acceptSpeak } from "./speak.ts"

// The one POST handler both speak routes use: same-origin JSON { text } only, spoken into the
// given pool. /api/speak uses the Voice Quiz's pool, /api/speak/reading Read Aloud's.
export function speakHandler(pool: Pool): (request: Request) => Promise<Response> {
  return async (request) => {
    if (!sameOrigin(request)) return Response.json({ ok: false }, { status: 400 })
    const text = acceptSpeak({
      origin: request.headers.get("origin"),
      contentType: request.headers.get("content-type"),
      body: await readJsonBody(request),
      allowedOrigin: browserOrigin(request),
    })
    if (text === null) return Response.json({ ok: false }, { status: 400 })
    const clip = await clipFor(text, pool)
    if (!clip) return Response.json({ ok: false }, { status: 500 })
    return new Response(new Uint8Array(clip), { headers: { "Content-Type": "audio/wav", "Cache-Control": "no-store" } })
  }
}
