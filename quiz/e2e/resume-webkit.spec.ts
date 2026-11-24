import { test, expect } from "./fixtures"

// The installed app's launch is the iPhone's, so the flows that do not depend on holding a request back are tried in WebKit too
// (a held request is not held there when the offline worker answers it, so the slow-page tests run in Chromium).
test.beforeEach(async ({ page }) => {
  await page.context().addInitScript(() => {
    Object.defineProperty(navigator, "standalone", { value: true, configurable: true })
  })
})

test("a launch on home opens the page left less than 24 hours ago, at the place it was left", async ({ page, context }) => {
  await page.goto("/glossary")
  await expect(page.locator("main")).toBeVisible()
  await page.evaluate(() => window.scrollTo(0, 600))
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("quiz-last-page") ?? "{}").scroll), "saved as it is scrolled").toBe(600)
  const launch = await context.newPage()
  await launch.goto("/")
  await expect(launch).toHaveURL(/\/glossary$/)
  await expect.poll(() => launch.evaluate(() => Math.round(window.scrollY)), "opened where it was left").toBe(600)
  await expect(launch.locator("html")).not.toHaveAttribute("data-resuming", /.*/)
  await expect(launch.locator('[data-page-ready="true"]')).toHaveCount(1)
})

test("a full page load of home made from inside the app is not a launch", async ({ page }) => {
  await page.goto("/progress")
  await expect.poll(() => page.evaluate(() => localStorage.getItem("quiz-last-page"))).toContain("/progress")
  await page.goto("/", { referer: new URL("/progress", page.url()).href })
  expect(await page.evaluate(() => document.referrer)).toContain("/progress")
  await expect(page.locator('[data-page-ready="true"]')).toHaveCount(1)
  await page.waitForTimeout(1000)
  await expect(page).toHaveURL(/\/$/)
})
