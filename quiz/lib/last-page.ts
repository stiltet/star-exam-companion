// The installed app reopens on the page it was left on, when that was within the last 24 hours.
// iOS ends the app's process in the background, and the next launch opens the start page.

export const LAST_PAGE_KEY = "quiz-last-page"
export const LAST_PAGE_MAX_AGE_MS = 24 * 60 * 60 * 1000

// scroll: how far down the page was, in whole pixels, so the launch opens at the same place.
export type LastPage = { path: string; at: number; scroll: number }

// A path to record: inside the app, and not an API route or a file. Home is recorded too, so that
// leaving the app on home opens home again and not an older page.
export function rememberable(path: string): boolean {
  // A backslash is read as a slash by a browser, so "/\\host" would be another origin.
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) return false
  const bare = path.split(/[?#]/)[0]
  if (bare === "") return false
  if (bare === "/api" || bare.startsWith("/api/")) return false
  return !/\.[a-z0-9]+$/i.test(bare)
}

// Whether the saved page can be opened now. Online the app asks the server (and the offline worker answers from its
// copy when the Mac cannot be reached, which Next.js loads in full). Offline only a page the device holds opens, so
// the "not on this device" page is never the result of a launch. A cache that cannot be read counts as not held.
export async function canOpenPage(online: boolean, held: () => Promise<boolean>): Promise<boolean> {
  if (online) return true
  try {
    return await held()
  } catch {
    // The copy cannot be looked up: treat the page as not on the device, so the app stays on home.
    return false
  }
}

export const serialiseLastPage = (page: LastPage): string => JSON.stringify(page)

export function parseLastPage(raw: string | null): LastPage | null {
  if (raw === null) return null
  try {
    const value: unknown = JSON.parse(raw)
    if (typeof value !== "object" || value === null) return null
    const { path, at, scroll } = value as { path?: unknown; at?: unknown; scroll?: unknown }
    if (typeof path !== "string" || typeof at !== "number" || !Number.isFinite(at)) return null
    const y = typeof scroll === "number" && Number.isFinite(scroll) && scroll >= 0 && scroll <= 9_999_999 ? Math.round(scroll) : 0
    return rememberable(path) ? { path, at, scroll: y } : null
  } catch {
    // Not JSON: nothing this app wrote.
    return null
  }
}

// Where a launch should go. Only the first load of a session that lands on home is moved, and only
// to a page left less than 24 hours ago (a stamp from the future counts as stale).
export function resumeTarget(saved: LastPage | null, now: number, currentPath: string, firstLoad: boolean): string | null {
  if (!saved || !firstLoad || currentPath !== "/" || saved.path.split(/[?#]/)[0] === "/") return null
  const age = now - saved.at
  if (age < 0 || age > LAST_PAGE_MAX_AGE_MS) return null
  return saved.path
}

// Runs in the page before it is drawn, so a launch that is about to move to the last page shows the
// loading screen from the first frame instead of the home page for a moment. It only marks <html>
// data-resuming with the time; ResumeLastPage takes the mark off once the other page is ready.
// A launch has no referrer and is a plain navigation: a reload, Back, or a full page load made by a tap on a link inside
// the app is not one, so tapping Home can never be sent back to the page it left. Keep it in step with
// resumeTarget (it is tested against it) and with isLaunch.
export const RESUME_MARK = "data-resuming"
export const RESUME_SCRIPT = `try{var d=document.documentElement;if((navigator.standalone===true||matchMedia("(display-mode: standalone)").matches)&&location.pathname==="/"&&!document.referrer&&(function(){var n=performance.getEntriesByType("navigation")[0];return!n||n.type==="navigate"})()){var v=JSON.parse(localStorage.getItem(${JSON.stringify(LAST_PAGE_KEY)}));var a=Date.now()-v.at;if(typeof v.path==="string"&&v.path.split(/[?#]/)[0]!=="/"&&a>=0&&a<=${LAST_PAGE_MAX_AGE_MS})d.setAttribute(${JSON.stringify(RESUME_MARK)},String(Date.now()))}}catch(e){/*no readable record: the app opens home*/}`

// The same test as the script's, for the component.
export function isLaunch(referrer: string, navigationType: string | undefined): boolean {
  return referrer === "" && (navigationType === undefined || navigationType === "navigate")
}
