// The browser the capture commands share: a separate Chrome for Testing on its own profile folder (never the user's everyday
// Chrome), started headless as a plain process or already running on the debugging port, with one background tab of its own.
// The settings below have the real defaults; the READING_* variables exist so the tests can point the commands at a fake site
// and a scratch profile.
import { spawn, type ChildProcess } from "node:child_process"
import { homedir } from "node:os"
import path from "node:path"
import { chromium, type Browser, type BrowserContext, type Page } from "@playwright/test"
import { maskAddress } from "../lib/debug-log.ts"
import { debug, log } from "./reading-log.mts"

export const SITE = process.env.READING_SITE || "https://www.skills.google"
export const ENDPOINT = process.env.READING_CDP_URL || "http://127.0.0.1:9222"

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// The profile folder, outside the repository. READING_PROFILE_DIR replaces it (tests).
export function profileFolder(): string {
  if (process.env.READING_PROFILE_DIR) return process.env.READING_PROFILE_DIR
  const base = process.platform === "darwin"
    ? path.join(homedir(), "Library", "Application Support")
    : process.platform === "win32"
      ? process.env.APPDATA || path.join(homedir(), "AppData", "Roaming")
      : process.env.XDG_DATA_HOME || path.join(homedir(), ".local", "share")
  return path.join(base, "star-exam-companion", "cft-profile")
}

// The hosts a lesson's embedded reading may come from: Google's public lesson storage, or the hosts in READING_FRAME_HOSTS (tests).
export function isLessonHost(host: string): boolean {
  const extra = (process.env.READING_FRAME_HOSTS ?? "").split(",").map((entry) => entry.trim()).filter(Boolean)
  return /(^|\.)storage\.googleapis\.com$/.test(host) || extra.includes(host)
}

function startHeadlessChrome(): ChildProcess {
  const port = new URL(ENDPOINT).port || "9222"
  const child = spawn(chromium.executablePath(), ["--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${profileFolder()}`], { stdio: "ignore", detached: true })
  // Own process group, so Ctrl-C in the terminal does not reach Chrome: the command closes it properly when it ends.
  child.unref()
  return child
}

// Presses the link or button whose text matches, also inside the page's own custom elements. False when there is none.
async function clickByText(page: Page, pattern: RegExp): Promise<boolean> {
  const handle = await page.evaluateHandle((source) => {
    const wanted = new RegExp(source, "i")
    let found: Element | null = null
    const walk = (root: Document | ShadowRoot): void => {
      for (const element of root.querySelectorAll("a,button,ql-button,[role=button]")) {
        const text = (element.getAttribute("label") || element.getAttribute("aria-label") || element.textContent || "").trim().replace(/\s+/g, " ")
        if (!found && wanted.test(text)) found = element
      }
      for (const element of root.querySelectorAll("*")) if (element.shadowRoot) walk(element.shadowRoot)
    }
    walk(document)
    return found
  }, pattern.source)
  const element = handle.asElement()
  if (!element) return false
  await element.click().catch(() => {})
  return true
}

// Google's own account chooser, if the sign-in ever shows one: picks the account named in READING_GOOGLE_ACCOUNT, otherwise the first.
async function chooseAccount(page: Page): Promise<void> {
  const rows = page.locator("[data-identifier]")
  const wanted = process.env.READING_GOOGLE_ACCOUNT
  const row = wanted ? rows.filter({ hasText: wanted }).first() : rows.first()
  await row.click({ timeout: 3_000 }).catch(() => {})
}

// The site's own sign-in: its "Sign in" link, then its "Sign in with Google" button. The browser's profile already holds the Google
// session, so this lands back on the site signed in, with no password typed. False when there is no "Sign in" link (already signed
// in) or the buttons do not lead back to the site.
async function signInWithButtons(page: Page): Promise<boolean> {
  if (!(await clickByText(page, /^sign in$/))) {
    debug("signin.step", { step: "no Sign in link", note: "already signed in" })
    return false
  }
  debug("signin.step", { step: "pressed Sign in" })
  await page.waitForURL(/\/users\/sign_in/, { timeout: 20_000 }).catch(() => {})
  if (!(await clickByText(page, /^sign in with google$/))) {
    debug("signin.step", { step: "no Sign in with Google button", url: maskAddress(page.url()) })
    return false
  }
  debug("signin.step", { step: "pressed Sign in with Google" })
  const site = new URL(SITE)
  for (let attempt = 0; attempt < 60; attempt += 1) {
    await sleep(500)
    let url: URL
    try {
      url = new URL(page.url())
    } catch {
      continue
    }
    if (url.host === site.host && !url.pathname.startsWith("/users/sign_in")) return true
    if (url.host === "accounts.google.com") {
      debug("signin.step", { step: "Google account chooser" })
      await chooseAccount(page)
    }
  }
  return false
}

// Signs in to the site. First the browser's own account prompt (not part of the page): choosing that account is the "Continue as"
// button, done through Chrome's own prompt commands. When no prompt appears, the site's "Sign in" and "Sign in with Google" buttons are
// pressed instead. No password is ever typed. READING_SKIP_SIGNIN=1 skips signing in (tests); READING_PROMPT_WAIT_MS shortens the wait
// for the prompt (tests).
export async function acceptOfferedSignIn(page: Page, context: BrowserContext): Promise<boolean> {
  if (process.env.READING_SKIP_SIGNIN === "1") {
    log("signin.route", { route: "skipped" })
    return false
  }
  const began = Date.now()
  const cdp = await context.newCDPSession(page)
  const seen: { dialog?: { dialogId: string; accounts?: { email?: string }[] } } = {}
  cdp.on("FedCm.dialogShown" as never, ((dialog: { dialogId: string; accounts?: { email?: string }[] }) => {
    seen.dialog = dialog
  }) as never)
  await cdp.send("FedCm.enable" as never, { disableRejectionDelay: true } as never)
  const promptWait = Number(process.env.READING_PROMPT_WAIT_MS ?? 8_000)
  try {
    await page.goto(`${SITE}/`, { waitUntil: "domcontentloaded" })
    for (let attempt = 0; attempt < 2 && !seen.dialog; attempt += 1) {
      // A prompt may not show in a background tab: the second try brings the tab forward once.
      if (attempt === 1) {
        await page.bringToFront()
        await page.reload({ waitUntil: "domcontentloaded" })
      }
      const end = Date.now() + promptWait
      while (!seen.dialog && Date.now() < end) await sleep(250)
    }
    if (!seen.dialog) {
      debug("signin.prompt", { appeared: false, waitedMs: Date.now() - began })
      const signedIn = await signInWithButtons(page)
      log("signin.route", { route: "buttons", ok: signedIn, ms: Date.now() - began })
      return signedIn
    }
    log("signin.route", { route: "prompt", ms: Date.now() - began })
    // READING_GOOGLE_ACCOUNT names the account to use (the secondary one). With it set, only that account is picked; when the prompt does
    // not offer it, none is, and the crawl then stops because the signed-in account is not the wanted one.
    const wantedAccount = process.env.READING_GOOGLE_ACCOUNT?.trim().toLowerCase()
    let accountIndex = 0
    if (wantedAccount) {
      const offered = seen.dialog.accounts ?? []
      accountIndex = offered.findIndex((account) => account.email?.toLowerCase() === wantedAccount)
      log("signin.account", { wanted: true, offered: offered.length, matched: accountIndex >= 0 })
      if (accountIndex < 0) return false
    }
    await cdp.send("FedCm.selectAccount" as never, { dialogId: seen.dialog.dialogId, accountIndex } as never)
    await sleep(5_000)
    return true
  } finally {
    await cdp.send("FedCm.disable" as never).catch(() => {})
    await cdp.detach().catch(() => {})
  }
}

// Who is signed in: the address on the site's account settings page. Null when the page does not show one (not signed in, or the
// page changed). It only reads; it never changes anything.
export async function signedInAs(page: Page): Promise<string | null> {
  try {
    await page.goto(`${SITE}/users/edit`, { waitUntil: "domcontentloaded", timeout: 30_000 })
  } catch {
    return null
  }
  for (let attempt = 0; attempt < 12; attempt += 1) {
    if (page.url().includes("/users/sign_in")) return null
    const found = await page.evaluate(() => {
      const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      let result: string | null = null
      const walk = (root: Document | ShadowRoot): void => {
        for (const element of root.querySelectorAll("*")) {
          const value = (element as HTMLInputElement).value ?? element.getAttribute("value") ?? ""
          if (!result && typeof value === "string" && pattern.test(value.trim())) result = value.trim()
          if (element.shadowRoot) walk(element.shadowRoot)
        }
      }
      walk(document)
      return result
    }).catch(() => null)
    if (found) {
      log("signin.user", { address: found })
      return found
    }
    await sleep(500)
  }
  log("signin.user", { address: "unknown" })
  return null
}

export type OpenBrowser = {
  browser: Browser
  context: BrowserContext
  page: Page
  isConnected: () => boolean
  // Closes the tab, and the browser too when this command started it. A browser the user started stays open.
  close: () => Promise<void>
}

// Attaches to a Chrome for Testing already on the port, or starts the headless one. Returns null when neither works.
export async function openBrowser(): Promise<OpenBrowser | null> {
  const began = Date.now()
  let started: ChildProcess | undefined
  let browser: Browser | undefined = await chromium.connectOverCDP(ENDPOINT).catch(() => undefined)
  if (browser) log("browser.attach", { endpoint: ENDPOINT })
  if (!browser) {
    started = startHeadlessChrome()
    log("browser.start", { endpoint: ENDPOINT, headless: true })
    for (let attempt = 0; attempt < 40 && !browser; attempt += 1) {
      browser = await chromium.connectOverCDP(ENDPOINT).catch(() => undefined)
      if (!browser) await sleep(500)
    }
  }
  if (!browser) {
    started?.kill()
    log("browser.unreachable", { endpoint: ENDPOINT, waitedMs: Date.now() - began })
    return null
  }
  log("browser.ready", { started: Boolean(started), ms: Date.now() - began })
  // One tab of its own, opened in the background so it never takes the window or the focus from what the user is doing.
  const context = browser.contexts()[0]
  const opened = context.waitForEvent("page")
  const session = await browser.newBrowserCDPSession()
  await session.send("Target.createTarget", { url: "about:blank", background: true })
  const page = await opened
  const connected = browser
  return {
    browser: connected,
    context,
    page,
    isConnected: () => connected.isConnected(),
    close: async () => {
      await page.close().catch(() => {})
      // A Chrome this run started is closed with Chrome's own close command, so it saves its profile.
      if (started) await connected.newBrowserCDPSession().then((closer) => closer.send("Browser.close")).catch(() => {})
      await connected.close().catch(() => {})
      log("browser.close", { closedByCommand: Boolean(started) })
    },
  }
}

export const NO_BROWSER_MESSAGE =
  `Could not start or reach Chrome for Testing on ${ENDPOINT}.\n` +
  `  Install it once with: pnpm --dir quiz exec playwright install chromium\n` +
  `  See skills/capture-reading/SKILL.md.`
