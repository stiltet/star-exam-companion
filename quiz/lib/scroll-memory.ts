// What the Back button remembers so a page it returns to opens where it was left.

export const scrollKey = (path: string): string => `quiz-scroll:${path}`

// A saved scroll position: a whole number of pixels, zero or more. Anything else is no position.
export function parseScroll(raw: string | null): number | null {
  if (raw === null || !/^\d{1,7}$/.test(raw)) return null
  return Number(raw)
}

// Whether the page was opened from another page of this app. After a full page load, which Next.js
// falls back to when it cannot do a client-side move (offline, with no copy kept), the page no
// longer knows its own history, but the browser still names the page it came from.
export function cameFromApp(referrer: string, origin: string): boolean {
  try {
    return referrer !== "" && new URL(referrer).origin === origin
  } catch {
    // A referrer that is not an address did not come from a page of this app.
    return false
  }
}
