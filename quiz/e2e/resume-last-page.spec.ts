import { test, expect } from "./fixtures"
import type { Page } from "@playwright/test"

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

test("a launch on home goes to the last page left less than 24 hours ago", async ({ page, context }) => {
  await page.goto("/progress")
  await expect.poll(() => page.evaluate(() => localStorage.getItem("quiz-last-page"))).toContain("/progress")
  const launch = await context.newPage()
  await launch.goto("/")
  await expect(launch).toHaveURL(/\/progress$/)
})

test("a launch after 24 hours opens home, and so does Home tapped inside the app", async ({ page, context }) => {
  await page.goto("/progress")
  // The old stamp is written by the launching page itself, as it starts: the first page also saves its own place when
  // another page opens beside it, which would replace a stamp set from outside.
  await context.addInitScript(() => {
    if (location.pathname !== "/" || document.referrer || sessionStorage.getItem("seeded")) return
    sessionStorage.setItem("seeded", "1")
    localStorage.setItem("quiz-last-page", JSON.stringify({ path: "/progress", at: Date.now() - 25 * 60 * 60 * 1000 }))
  })
  const launch = await context.newPage()
  await launch.goto("/")
  await opened(launch)
  await expect(launch).toHaveURL(/\/$/)
  await page.evaluate(() => localStorage.setItem("quiz-last-page", JSON.stringify({ path: "/progress", at: Date.now() })))
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

test("a launch opens the page at the place it was left, and the place is saved as the page is scrolled", async ({ page, context }) => {
  await page.goto("/glossary")
  await expect(page.locator("main")).toBeVisible()
  const height = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight)
  expect(height, "the page is long enough to scroll").toBeGreaterThan(600)
  await page.evaluate(() => window.scrollTo(0, 600))
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("quiz-last-page") ?? "{}").scroll), "saved as it is scrolled").toBe(600)
  const launch = await context.newPage()
  await launch.goto("/")
  await expect(launch).toHaveURL(/\/glossary$/)
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
  const { shown, gone } = await page.evaluate(() => (window as unknown as { __box: { shown?: number; gone?: number } }).__box)
  expect(shown, "the box showed").toBeDefined()
  expect(gone, "and went").toBeDefined()
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

test("leaving the app while the saved page is still coming keeps the saved place", async ({ page, context }) => {
  await page.goto("/glossary")
  await expect(page.locator("main")).toBeVisible()
  await page.evaluate(() => window.scrollTo(0, 500))
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("quiz-last-page") ?? "{}").scroll)).toBe(500)
  const launch = await context.newPage()
  // The saved page takes 5 s to come, longer than the cover is kept (3 s).
  await launch.route(/\/glossary(\?|$)/, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 5000))
    await route.continue()
  })
  await launch.goto("/")
  await expect(launch.locator("html")).not.toHaveAttribute("data-resuming", /.*/, { timeout: 6000 })
  await launch.evaluate(() => window.dispatchEvent(new Event("pagehide")))
  expect(await launch.evaluate(() => JSON.parse(localStorage.getItem("quiz-last-page") ?? "{}")), "still the saved page and place").toMatchObject({ path: "/glossary", scroll: 500 })
  await expect(launch).toHaveURL(/\/glossary$/, { timeout: 15_000 })
  await expect.poll(() => launch.evaluate(() => Math.round(window.scrollY))).toBe(500)
})
