import type { Store } from "./outbox.ts"
import { writeSnapshot, type Snapshot } from "./snapshot.ts"
import { scoped } from "./scope.ts"

// When the copy on the device last came fresh from the Mac, as an ISO time.
export const SNAPSHOT_AT_KEY = scoped("quiz-snapshot-at")

export type Connection = "loading" | "mac" | "device" | "none"

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

function day(iso: string | null): string | null {
  if (!iso) return null
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? null : `${date.getDate()} ${MONTHS[date.getMonth()]}`
}

// What the connection icon says to screen readers. An offline copy is always named as one, with
// its date, so old data never passes as new.
export function connectionText(from: Connection, fetchedAt: string | null): string {
  if (from === "loading") return "Checking the Mac"
  if (from === "mac") return "Live from the Mac"
  if (from === "none") return "Offline: no copy on this device yet"
  const when = day(fetchedAt)
  return when ? `Offline: copy from ${when}` : "Offline: copy from an unknown date"
}

export type UpdateDeps = {
  fetchSnapshot: () => Promise<Snapshot | null>
  store: Store
  // Gets the latest worker and code; deletes nothing, so offline keeps working.
  refreshWorker: () => Promise<void>
  reload: () => void
  now: () => Date
}

// Update now: nothing is replaced until the Mac has sent a fresh copy, and unsent answers are
// never touched, so a failed update leaves the device exactly as it was.
export async function forceUpdate(deps: UpdateDeps): Promise<"updated" | "unreachable"> {
  const snapshot = await deps.fetchSnapshot()
  if (!snapshot) return "unreachable"
  writeSnapshot(deps.store, snapshot)
  try {
    deps.store.setItem(SNAPSHOT_AT_KEY, deps.now().toISOString())
  } catch {
    // Storage full: the copy is still current; only its date is missing.
  }
  try {
    await deps.refreshWorker()
  } catch {
    // The Mac dropped before the worker could be checked: the copy is new, so reload anyway;
    // the worker is checked again on the next visit.
  }
  deps.reload()
  return "updated"
}
