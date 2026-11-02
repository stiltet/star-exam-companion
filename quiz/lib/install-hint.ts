// When the quiz offers to be added to the home screen, and how. Pure, so it is tested without a browser.

export type InstallPlatform = "android" | "ios-safari" | "ios-other" | "other"

// Browsers inside another app (Instagram, Facebook, LinkedIn, Gmail and similar) cannot install.
const IN_APP = /FBAN|FBAV|Instagram|Line\/|LinkedInApp|Snapchat|Twitter|GSA\/|Gmail|MicroMessenger|musical_ly|BytedanceWebview|TikTok|;\s*wv(?:\)|;|$)/i

// iPadOS reports a Mac, so a Mac with touch points is an iPad.
export function detectPlatform(userAgent: string, maxTouchPoints: number): InstallPlatform {
  const ios = /iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1)
  if (IN_APP.test(userAgent)) return "other"
  if (ios) {
    if (/CriOS|FxiOS|EdgiOS|OPiOS/.test(userAgent)) return "ios-other"
    return /Safari/.test(userAgent) ? "ios-safari" : "other"
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
  dismissedAt: number | null
  now: number
}

// Android offers the browser's own prompt when it has one, and the menu steps when it has not. A
// browser cannot say that the app is already installed, so the tip may reach someone who has it; Not
// now hides it for 30 days. Desktop, in-app browsers and the installed app get nothing; iOS browsers
// other than Safari are told to open the page in Safari.
export function shouldOffer(state: InstallState): boolean {
  if (state.standalone || state.installed || state.platform === "other") return false
  if (state.dismissedAt !== null && state.now - state.dismissedAt < DISMISS_DAYS * DAY_MS) return false
  return true
}

// Shown at once on a second visit, after SHOW_AFTER_MS on the first.
export function showDelay(visits: number): number {
  return visits >= 2 ? 0 : SHOW_AFTER_MS
}

// What the Android card says: the prompt's benefit when the browser handed one over, the menu steps
// when it did not (Firefox, or a Chrome that has already shown it).
export function androidCopy(hasPrompt: boolean): string {
  return hasPrompt
    ? "Opens full screen, like an app, and works offline."
    : "Open your browser menu (⋮ or ≡), then tap Install app or Add to Home screen."
}
