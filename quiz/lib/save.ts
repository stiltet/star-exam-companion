import type { SendResult } from "./outbox.ts"
import type { Answer } from "./score.ts"
import { STATIC_DEMO } from "./static-demo.ts"

// Sends one batch to the Mac. The Mac's verdict per answer, or null when it did not take the
// batch: no network, an error status, or a body that is not { ok: true, ... }. The online demo has
// no server, so it sends nothing and the answers stay on the device.
export async function postAnswers(answers: Answer[], post: typeof fetch = fetch): Promise<SendResult | null> {
  if (STATIC_DEMO) return null
  try {
    const response = await post("/api/scores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers }),
    })
    const body = (await response.json()) as Partial<SendResult> & { ok?: boolean }
    if (!response.ok || body.ok !== true) return null
    const ids = (value: unknown) => (Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : [])
    const gone = ids(body.gone)
    const reasons = body.reasons && typeof body.reasons === "object" && !Array.isArray(body.reasons)
      ? Object.fromEntries(Object.entries(body.reasons).filter((entry): entry is [string, string] => typeof entry[1] === "string"))
      : undefined
    return { stored: ids(body.stored), duplicate: ids(body.duplicate), rejected: ids(body.rejected), ...(gone.length ? { gone } : {}), ...(reasons ? { reasons } : {}) }
  } catch {
    // Not sent: the answers stay in the outbox for the next try.
    return null
  }
}
