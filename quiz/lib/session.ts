import { IDLE_MS, type ScoreLine } from "./learn.ts"

let id = 0
let last = 0

// The session a new answer belongs to. The first call after the server starts, or the first after
// IDLE_MS without a call, opens a new one above every session already in the scores; any other
// call keeps the current one. A service restart therefore starts a new session.
export function currentSession(lines: ScoreLine[], now = Date.now()): number {
  const floor = lines.reduce((max, line) => Math.max(max, line.session), 0)
  if (id === 0 || now - last > IDLE_MS) id = floor + 1
  last = now
  return id
}
