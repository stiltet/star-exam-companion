import { test, expect } from "./fixtures"
import type { BrowserContext, Page } from "@playwright/test"

// The installed app reopens on the page it was left on, within 24 hours. A new tab of the same context
// stands for the launch after iOS ended the app: localStorage stays, sessionStorage starts empty.
test.beforeEach(async ({ page }) => {
  await page.context().addInitScript(() => {
    Object.defineProperty(navigator, "standalone", { value: true, configurable: true })
  })
})

// A page that stays where it is has shown itself: the gate is open, which comes after the launch has had every chance to move.
const opened = async (page: Page) => {
  await expect(page.locator('[data-page-ready="true"]')).toHaveCount(1)
  // A page that stays is proved by nothing happening, so this window is deliberate: the move would start in the first
  // tens of milliseconds after hydration, and the gate above only opens after it. One second is far more than it needs.
  await page.waitForTimeout(1000)
}

test("a launch after 24 hours opens home, and so does Home tapped inside the app", async ({ page, context }) => {
  await page.goto("/progress")
  const exam = await page.evaluate(() => document.documentElement.dataset.exam ?? "")
  // The old stamp is written by the launching page itself, as it starts: the first page also saves its own place when
  // another page opens beside it, which would replace a stamp set from outside. It names the exam, so only its age keeps the launch on home.
  await context.addInitScript((name) => {
    if (location.pathname !== "/" || document.referrer || sessionStorage.getItem("seeded")) return
    sessionStorage.setItem("seeded", "1")
    localStorage.setItem("quiz-last-page", JSON.stringify({ path: "/progress", at: Date.now() - 25 * 60 * 60 * 1000, exam: name }))
  }, exam)
  const launch = await context.newPage()
  await launch.goto("/")
  await opened(launch)
  await expect(launch).toHaveURL(/\/$/)
  await page.evaluate((name) => localStorage.setItem("quiz-last-page", JSON.stringify({ path: "/progress", at: Date.now(), exam: name })), exam)
  await page.locator("header a:has(img)").first().click()
  await expect(page).toHaveURL(/\/$/)
  await opened(page)
  await expect(page).toHaveURL(/\/$/)
})

test("leaving the app on home opens home again, not an older page", async ({ page, context }) => {
  await page.goto("/progress")
  await expect.poll(() => page.evaluate(() => localStorage.getItem("quiz-last-page"))).toContain("/progress")
  await page.locator("header a:has(img)").first().click()
  await expect(page).toHaveURL(/\/$/)
  await expect.poll(() => page.evaluate(() => localStorage.getItem("quiz-last-page"))).toContain('"path":"/"')
  const launch = await context.newPage()
  await launch.goto("/")
  await opened(launch)
  await expect(launch).toHaveURL(/\/$/)
})

test("a full page load of home made from inside the app is not a launch", async ({ page }) => {
  await page.goto("/progress")
  await expect.poll(() => page.evaluate(() => localStorage.getItem("quiz-last-page"))).toContain("/progress")
  await page.goto("/", { referer: new URL("/progress", page.url()).href })
  // The test is only worth something if the page really arrived with a referrer (that is what makes it not a launch).
  expect(await page.evaluate(() => document.referrer)).toContain("/progress")
  await opened(page)
  await expect(page).toHaveURL(/\/$/)
})

test("a launch on home opens the page left less than 24 hours ago at its place and its hash, saved as the page is scrolled and the hash changes", async ({ page, context }) => {
  await page.goto("/glossary")
  await expect(page.locator("main")).toBeVisible()
  const height = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight)
  expect(height, "the page is long enough to scroll").toBeGreaterThan(600)
  await page.evaluate(() => window.scrollTo(0, 600))
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("quiz-last-page") ?? "{}").scroll), "saved as it is scrolled").toBe(600)
  // A view named by the hash (an exam under review) is part of the place, and a change of it is saved.
  await page.evaluate(() => {
    location.hash = "#view-1"
  })
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("quiz-last-page") ?? "{}").path), "saved with the hash").toBe("/glossary#view-1")
  const launch = await context.newPage()
  await launch.goto("/")
  await expect(launch).toHaveURL(/\/glossary#view-1$/)
  await expect.poll(() => launch.evaluate(() => Math.round(window.scrollY)), "opened where it was left").toBe(600)
  await expect(launch.locator("html")).not.toHaveAttribute("data-resuming", /.*/)
  // Opening the page does not wipe the saved place before the visitor scrolls again.
  expect(await launch.evaluate(() => JSON.parse(localStorage.getItem("quiz-last-page") ?? "{}").scroll)).toBe(600)
})

test("a loading box that has shown stays 500 ms even when the page arrives at once", async ({ page }) => {
  // The page comes 300 ms after the tap: the box shows at 200 ms and the page is there 100 ms later, so only the hold keeps it.
  await page.route((url) => url.pathname === "/", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 300))
    await route.continue()
  })
  await page.goto("/glossary", { waitUntil: "domcontentloaded" })
  await page.evaluate(() => {
    const seen: { shown?: number; gone?: number } = {}
    ;(window as unknown as { __box: typeof seen }).__box = seen
    new MutationObserver(() => {
      const there = !!document.querySelector('[role="status"][aria-label="Loading"].loading-full')
      if (there) seen.shown ??= performance.now()
      else if (seen.shown !== undefined) seen.gone ??= performance.now()
    }).observe(document.body, { childList: true, subtree: true })
  })
  await page.locator("header a:has(img)").first().click()
  await expect(page).toHaveURL(/\/$/, { timeout: 15_000 })
  await expect(page.locator('[data-page-ready="true"]')).toHaveCount(1)
  // A tap on the logo is a move inside the app: the page, and this observer, stay while the new page comes.
  // The box may still be on its hold when the page is ready, so wait for it to go.
  await expect.poll(() => page.evaluate(() => (window as unknown as { __box: { gone?: number } }).__box.gone), { message: "the box went", timeout: 10_000 }).toBeDefined()
  const { shown, gone } = await page.evaluate(() => (window as unknown as { __box: { shown?: number; gone?: number } }).__box)
  expect(shown, "the box showed").toBeDefined()
  expect(gone! - shown!, "after at least 500 ms").toBeGreaterThanOrEqual(480)
})

test("a launch the early script did not cover still opens the saved page at its place, once the page is there", async ({ page, context }) => {
  await page.goto("/glossary")
  await expect(page.locator("main")).toBeVisible()
  await page.evaluate(() => window.scrollTo(0, 500))
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("quiz-last-page") ?? "{}").scroll)).toBe(500)
  // The mark the early script puts on the page is taken off at once, as if it had never been drawn.
  await context.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => document.documentElement.removeAttribute("data-resuming"))
  })
  const launch = await context.newPage()
  await launch.goto("/")
  await expect(launch).toHaveURL(/\/glossary$/)
  await expect.poll(() => launch.evaluate(() => Math.round(window.scrollY)), "the place is restored on the page it opens, not on home").toBe(500)
})

type Seen = { covered: boolean; shown?: number; gone?: number; bare: number }

// Watches every frame of a launching page: when the loading box that hides the page showed and went, and every frame in which home was
// bare, that is the launch cover already gone, no box, and the saved page not yet there.
const watchFrames = (page: Page) =>
  page.addInitScript(() => {
    const seen: Seen = { covered: false, bare: 0 }
    ;(window as unknown as { __frames: Seen }).__frames = seen
    const frame = () => {
      const box = [...document.querySelectorAll('[role="status"][aria-label="Loading"].loading-full')].find((el) => !el.closest(".resume-cover"))
      const now = performance.now()
      if (box) {
        seen.shown ??= now
        seen.gone = undefined
      } else if (seen.shown !== undefined) seen.gone ??= now
      if (document.documentElement.hasAttribute("data-resuming")) seen.covered = true
      else if (seen.covered && !box && location.pathname === "/") seen.bare++
      requestAnimationFrame(frame)
    }
    requestAnimationFrame(frame)
  })
const framesOf = (page: Page) => page.evaluate(() => (window as unknown as { __frames: Seen }).__frames)

const leaveGlossaryAt = async (page: Page, y: number) => {
  await page.goto("/glossary")
  await expect(page.locator("main")).toBeVisible()
  await page.evaluate((to) => window.scrollTo(0, to), y)
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("quiz-last-page") ?? "{}").scroll)).toBe(y)
}

test("a slow saved page is covered by a full-screen box after the cover limit, never by a bare home; the box stays 500 ms once shown, and the place is kept and restored", async ({ page, context }) => {
  await leaveGlossaryAt(page, 500)
  const launch = await context.newPage()
  await watchFrames(launch)
  // The saved page is held until the test has seen the box, then let go 100 ms later: only the hold keeps the box up.
  let release = () => {}
  const held = new Promise<void>((resolve) => (release = resolve))
  await launch.route(/\/glossary(\?|$)/, async (route) => {
    await held
    await route.continue()
  })
  await launch.goto("/")
  // The cover has gone and the page is still not there: a loading box over the whole page takes over, and home is hidden behind it.
  await expect(launch.locator('[role="status"][aria-label="Loading"].loading-full')).toBeVisible({ timeout: 8000 })
  await expect(launch.locator("header")).toBeHidden()
  // Leaving the app now keeps the saved page and its place, not home at the top.
  await launch.evaluate(() => window.dispatchEvent(new Event("pagehide")))
  expect(await launch.evaluate(() => JSON.parse(localStorage.getItem("quiz-last-page") ?? "{}")), "still the saved page and place").toMatchObject({ path: "/glossary", scroll: 500 })
  await launch.waitForTimeout(100)
  release()
  await expect(launch).toHaveURL(/\/glossary$/, { timeout: 15_000 })
  await expect.poll(async () => (await framesOf(launch)).gone, { message: "the box went", timeout: 10_000 }).toBeDefined()
  const seen = await framesOf(launch)
  expect(seen.covered, "the launch cover was drawn").toBe(true)
  expect(seen.gone! - seen.shown!, "the box stayed at least 500 ms").toBeGreaterThanOrEqual(480)
  expect(seen.bare, "no frame of bare home between the cover and the box").toBe(0)
  await expect.poll(() => launch.evaluate(() => Math.round(window.scrollY))).toBe(500)
  // The hidden launch cover stays in the page, so only a box that shows (loading-full) is counted.
  await expect(launch.locator('[role="status"][aria-label="Loading"].loading-full')).toHaveCount(0)
})

test("a saved page that never comes is given up after 30 s: no place is restored, and the next page the visitor opens is saved again", async ({ page, context }) => {
  await leaveGlossaryAt(page, 500)
  const launch = await context.newPage()
  // The saved page is held for good. The page's clock is moved past the 30 s the launch watch waits, instead of waiting them out.
  await launch.clock.install()
  await launch.route(/\/glossary(\?|$)/, () => new Promise(() => {}))
  await launch.goto("/")
  await expect(launch.locator("html")).toHaveAttribute("data-resuming", /.*/)
  await launch.clock.fastForward(31_000)
  await expect(launch.locator("html")).not.toHaveAttribute("data-resuming", /.*/)
  await launch.clock.resume()
  await expect(launch.locator('[role="status"][aria-label="Loading"].loading-full'), "the slow-page box goes when the watch gives up").toHaveCount(0)
  expect(await launch.evaluate(() => Math.round(window.scrollY)), "no place is restored: home stays where it is").toBe(0)
  // The visitor opens another page: it is saved as the place to come back to, which only happens once the move to the saved page is over.
  await launch.locator('main a[href="/exam"]').first().click()
  await expect(launch).toHaveURL(/\/exam$/, { timeout: 15_000 })
  await expect.poll(() => launch.evaluate(() => JSON.parse(localStorage.getItem("quiz-last-page") ?? "{}").path), "saved again").toBe("/exam")
})

// A record the launch must not move to: it is written by the launching page itself, since the first page saves its own place as it closes.
const launchStays = async (context: BrowserContext, record: { path: string; exam: string }) => {
  const launch = await context.newPage()
  await launch.addInitScript((value) => {
    localStorage.setItem("quiz-last-page", JSON.stringify({ ...value, at: Date.now(), scroll: 0 }))
    // The early script marks the page in its first moments and the app takes the mark off soon after: watch for it ever being there.
    new MutationObserver(() => {
      if (document.documentElement.hasAttribute("data-resuming")) (window as unknown as { __marked: boolean }).__marked = true
    }).observe(document, { subtree: true, attributes: true, attributeFilter: ["data-resuming"] })
  }, record)
  await launch.goto("/")
  await opened(launch)
  await expect(launch).toHaveURL(/\/$/)
  expect(await launch.evaluate(() => (window as unknown as { __marked?: boolean }).__marked ?? false), "no cover was drawn for a move that does not happen").toBe(false)
  await launch.close()
}

test("a launch stays on home, with no cover, for a page left in another exam and for a path the client refuses", async ({ page, context }) => {
  await page.goto("/progress")
  const exam = await page.evaluate(() => document.documentElement.dataset.exam ?? "")
  await page.close()
  // The exam was switched since: the record names another one.
  await launchStays(context, { path: "/progress", exam: "another-exam" })
  await launchStays(context, { path: "/api/speak", exam })
})

test("a Read Aloud page that comes slowly is restored at its place once it is there, not while its route box shows", async ({ page, context }) => {
  await page.goto("/read")
  await expect(page.locator("main")).toBeVisible()
  const height = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight)
  expect(height, "the Read Aloud page is long enough to scroll").toBeGreaterThan(300)
  await page.evaluate(() => window.scrollTo(0, 300))
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("quiz-last-page") ?? "{}").scroll)).toBe(300)
  const launch = await context.newPage()
  // Home links to Read Aloud, so its route box is fetched ahead and shows while the page comes. Only the move itself is held 1.5 s.
  await launch.route(/\/read(\?|$)/, async (route) => {
    if (route.request().headers()["next-router-prefetch"]) return route.continue()
    await new Promise((resolve) => setTimeout(resolve, 1500))
    await route.continue()
  })
  await launch.goto("/")
  await expect(launch).toHaveURL(/\/read$/, { timeout: 15_000 })
  await expect.poll(() => launch.evaluate(() => Math.round(window.scrollY)), { message: "the place is restored on the page, not on the box before it", timeout: 15_000 }).toBe(300)
  await expect(launch.locator(".loading-route, [data-route-hold]")).toHaveCount(0)
})

test("a saved page is not opened over the page the visitor tapped to while the device was still being asked whether it holds it", async ({ page, context }) => {
  await leaveGlossaryAt(page, 500)
  const launch = await context.newPage()
  await launch.addInitScript(() => {
    // The app is told it is offline, so it asks the device for a copy, and the device answers "held" only after a second.
    Object.defineProperty(navigator, "onLine", { value: false, configurable: true })
    Object.defineProperty(caches, "match", {
      value: async () => {
        await new Promise((resolve) => setTimeout(resolve, 1000))
        return new Response("held")
      },
      configurable: true,
    })
  })
  await launch.goto("/")
  await expect(launch.locator("html")).toHaveAttribute("data-resuming", /.*/)
  // A tap made through the page, since home is still hidden behind the launch cover.
  await launch.evaluate(() => (document.querySelector('main a[href="/exam"]') as HTMLElement).click())
  await expect(launch).toHaveURL(/\/exam$/, { timeout: 15_000 })
  // The answer comes and the saved page is not opened over the page the visitor went to.
  await launch.waitForTimeout(2500)
  await expect(launch).toHaveURL(/\/exam$/)
  await expect(launch.locator("html")).not.toHaveAttribute("data-resuming", /.*/)
})
