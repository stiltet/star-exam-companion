// When the quiz offers to be added to the home screen, and how. Pure, so it is tested without a browser.

export type InstallPlatform = "android" | "ios-safari" | "ios-other" | "other"

// Browsers inside another app (Instagram, Facebook, LinkedIn, Gmail and similar) cannot install.
const IN_APP = /FBAN|FBAV|Instagram|Line\/|LinkedInApp|Snapchat|Twitter|GSA\//i

// iPadOS reports a Mac, so a Mac with touch points is an iPad.
export function detectPlatform(userAgent: string, maxTouchPoints: number): InstallPlatform {
  const ios = /iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1)
  if (IN_APP.test(userAgent)) return ios ? "ios-other" : "other"
  if (ios) {
    if (/CriOS|FxiOS|EdgiOS|OPiOS/.test(userAgent)) return "ios-other"
    return "ios-safari"
  }
  if (/Android/.test(userAgent)) return "android"
  return "other"
}

export const DISMISS_DAYS = 30
export const SHOW_AFTER_MS = 20_000
const DAY_MS = 24 * 60 * 60 * 1000

export type InstallState = {
  platform: InstallPlatform
  standalone: boolean
  installed: boolean
  // Android only: the browser has handed over its install prompt.
  canPrompt: boolean
  dismissedAt: number | null
  now: number
}

// Android waits for the browser's own prompt: it does not come when the app is already installed,
// so the tip never tells an installed user to install. iOS has no prompt to wait for. Desktop, in-app
// browsers and the installed app get nothing.
export function shouldOffer(state: InstallState): boolean {
  if (state.standalone || state.installed || state.platform === "other") return false
  if (state.platform === "android" && !state.canPrompt) return false
  if (state.dismissedAt !== null && state.now - state.dismissedAt < DISMISS_DAYS * DAY_MS) return false
  return true
}

// Shown at once on a second visit, after SHOW_AFTER_MS on the first.
export function showDelay(visits: number): number {
  return visits >= 2 ? 0 : SHOW_AFTER_MS
}
