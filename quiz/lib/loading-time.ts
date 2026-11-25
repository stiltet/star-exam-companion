// A loading screen that has shown stays at least this long, so a fast page never makes it flash.
export const LOADING_AFTER_MS = 200
export const LOADING_MIN_MS = 500

// How much longer a loading screen that appeared at `shownAt` must stay. Null: it never showed, so nothing is held back.
export function loadingRemaining(shownAt: number | null, now: number): number {
  if (shownAt === null) return 0
  return Math.max(0, shownAt + LOADING_MIN_MS - now)
}

// The same for a screen that shows by itself LOADING_AFTER_MS after `startedAt` (the page gate's box, drawn by CSS alone).
export function gateRemaining(startedAt: number, now: number): number {
  const elapsed = now - startedAt
  return elapsed < LOADING_AFTER_MS ? 0 : loadingRemaining(startedAt + LOADING_AFTER_MS, now)
}

// The same for the Read Aloud route box, which mounted at `mountedAt` and shows LOADING_AFTER_MS later (its CSS animation, whose end
// is `shownAt` when it has been seen). It is gone the moment its page is there, so the page that follows keeps the rest of its 500 ms.
// Null, or the page there before the box showed: nothing is held.
export function routeRemaining(mountedAt: number | null, now: number, shownAt: number | null = null): number {
  if (shownAt !== null) return loadingRemaining(shownAt, now)
  return mountedAt === null || now < mountedAt + LOADING_AFTER_MS ? 0 : loadingRemaining(mountedAt + LOADING_AFTER_MS, now)
}
