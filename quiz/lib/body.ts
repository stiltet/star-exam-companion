// Each route takes a tiny JSON body, so anything larger is refused before it is parsed.
export const MAX_BODY_BYTES = 8 * 1024

// The parsed JSON body, or null when it is missing, too large or not JSON. The body is read as a
// stream and abandoned past the cap, so a chunked request with no Content-Length cannot make the
// server buffer more than the cap either.
export async function readJsonBody(request: Request, max = MAX_BODY_BYTES): Promise<unknown> {
  const declared = Number(request.headers.get("content-length") ?? "0")
  if (declared > max) return null
  if (!request.body) return null
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > max) {
      await reader.cancel()
      return null
    }
    chunks.push(value)
  }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as unknown
  } catch {
    // Not JSON: the caller's accept function refuses a null body with a 400.
    return null
  }
}
