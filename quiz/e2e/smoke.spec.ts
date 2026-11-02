import { test, expect, openVoice } from "./fixtures"

const pages = ["/", "/exam", "/practice", "/flashcards", "/glossary", "/study", "/progress", "/read", "/read/night", "/about"]

for (const path of pages) {
  test(`${path} renders without browser errors or horizontal overflow`, async ({ page }) => {
    const response = await page.goto(path)
    expect(response?.status()).toBe(200)
    await expect(page.locator("main")).toBeVisible()
    await expect(page.locator("h1")).toHaveCount(1)
    await expect(page.locator("h1")).not.toBeEmpty()
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  })
}

test("Voice quiz renders through header navigation", async ({ page }) => {
  await openVoice(page)
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test("Study section and topic render", async ({ page }) => {
  await page.goto("/study")
  const topic = await page.locator('main a[href^="/study/"]').first().getAttribute("href")
  if (!topic) throw new Error("Study page has no topic link")
  const section = topic.slice(0, topic.lastIndexOf("/"))
  await page.waitForLoadState("networkidle")
  expect((await page.goto(section))?.status()).toBe(200)
  await expect(page.locator("h1")).not.toBeEmpty()
  await page.locator(`main a[href^="${section}/"]`).first().click()
  await expect(page).toHaveURL(/\/study\/[^/]+\/[^/]+$/)
  await expect(page.locator("h1")).not.toBeEmpty()
})
