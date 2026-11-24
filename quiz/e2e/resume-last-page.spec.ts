import { test, expect } from "./fixtures"

// The installed app reopens on the page it was left on, within 24 hours. A new tab of the same context
// stands for the launch after iOS ended the app: localStorage stays, sessionStorage starts empty.
test.beforeEach(async ({ page }) => {
  await page.context().addInitScript(() => {
    Object.defineProperty(navigator, "standalone", { value: true, configurable: true })
  })
})

test("a launch on home goes to the last page left less than 24 hours ago", async ({ page, context }) => {
  await page.goto("/progress")
  await expect.poll(() => page.evaluate(() => localStorage.getItem("quiz-last-page"))).toContain("/progress")
  const launch = await context.newPage()
  await launch.goto("/")
  await expect(launch).toHaveURL(/\/progress$/)
})

test("a launch after 24 hours opens home, and so does Home tapped inside the app", async ({ page, context }) => {
  await page.goto("/progress")
  await page.evaluate(() => localStorage.setItem("quiz-last-page", JSON.stringify({ path: "/progress", at: Date.now() - 25 * 60 * 60 * 1000 })))
  const launch = await context.newPage()
  await launch.goto("/")
  await launch.waitForTimeout(800)
  await expect(launch).toHaveURL(/\/$/)
  await page.evaluate(() => localStorage.setItem("quiz-last-page", JSON.stringify({ path: "/progress", at: Date.now() })))
  await page.locator("header a:has(img)").first().click()
  await expect(page).toHaveURL(/\/$/)
  await page.waitForTimeout(800)
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
  await launch.waitForTimeout(800)
  await expect(launch).toHaveURL(/\/$/)
})

test("a full page load of home made from inside the app is not a launch", async ({ page }) => {
  await page.goto("/progress")
  await expect.poll(() => page.evaluate(() => localStorage.getItem("quiz-last-page"))).toContain("/progress")
  await page.goto("/", { referer: new URL("/progress", page.url()).href })
  await page.waitForTimeout(800)
  await expect(page).toHaveURL(/\/$/)
})
