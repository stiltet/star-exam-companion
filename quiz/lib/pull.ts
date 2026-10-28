// Pull-to-refresh arithmetic, kept apart from the DOM so it can be tested.
export const PULL_TRIGGER_PX = 80
const PULL_MAX_PX = 120

// Pages that hold a round in memory: a reload would lose the exam, unsaved Voice Quiz answers,
// or a Practice or Flashcards run in progress.
export const NO_PULL_PATHS = ["/exam", "/voice", "/practice", "/flashcards"]

// Below this much movement a touch has no direction yet: the first touchmove is often 0 to 2px.
export const DEAD_ZONE_PX = 10

// How far the indicator follows the finger: half the drag, so it feels weighted, and capped.
export function pullDistance(dragPx: number): number {
  if (dragPx <= 0) return 0
  return Math.min(PULL_MAX_PX, dragPx / 2)
}

// Whether the indicator, shown at this distance, means letting go will reload.
export function isReady(pull: number): boolean {
  return pull >= PULL_TRIGGER_PX / 2
}

// Whether letting go after this drag reloads: only a pull that reached the trigger point.
export function shouldRefresh(dragPx: number): boolean {
  return isReady(pullDistance(dragPx))
}

// A pull counts only while it is mostly downward; a sideways swipe that drifts down does not.
export function isVerticalPull(dx: number, dy: number): boolean {
  return dy > 0 && Math.abs(dy) > Math.abs(dx)
}

// Whether the movement so far is too small to judge, so the pull is neither started nor dropped.
export function inDeadZone(dx: number, dy: number): boolean {
  return Math.hypot(dx, dy) < DEAD_ZONE_PX
}

export function pullAllowedOn(pathname: string): boolean {
  return !NO_PULL_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))
}
