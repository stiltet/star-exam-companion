import AxeBuilder from "@axe-core/playwright"
import type { Page } from "@playwright/test"
import { test, expect, openVoice } from "./fixtures"

// WCAG 2.1 level A and AA. Axe finds only what a machine can see: screen-reader flow and keyboard journeys are
// still checked by hand.
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]

const pages = ["/", "/exam", "/practice", "/flashcards", "/glossary", "/study", "/progress", "/read", "/read/night", "/about"]

async function scan(page: Page, label: string, found: string[]) {
  // Settled first, so a page still hydrating or fetching is not scanned half-built.
  await page.waitForLoadState("networkidle")
  const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze()
  for (const violation of violations) {
    const targets = violation.nodes.map((node) => node.target.join(" ")).slice(0, 3).join(" | ")
    found.push(`${label}: ${violation.id} (${violation.impact}) ×${violation.nodes.length}: ${targets}`)
  }
}

// One test for the main pages, one study section and topic, and the open menu, saving panel and answered question, so
// the scan costs one browser session and one scratch-scores reset. The course lesson pages are not scanned.
test("the main pages and states have no WCAG 2.1 AA violation axe can detect", async ({ page }) => {
  const found: string[] = []

  for (const path of pages) {
    await page.goto(path)
    await expect(page.locator("main"), path).toBeVisible()
    // The glossary is where the scan once found its first violation: prove it has terms, so it is not scanned empty.
    if (path === "/glossary") await expect(page.locator("dl dt").first(), path).toBeVisible()
    await scan(page, path, found)
  }

  await page.goto("/study")
  const topic = await page.locator('main a[href^="/study/"]').first().getAttribute("href")
  if (!topic) throw new Error("Study page has no topic link")
  const section = topic.slice(0, topic.lastIndexOf("/"))
  for (const path of [section, topic]) {
    await page.goto(path)
    await expect(page.locator("h1"), path).not.toBeEmpty()
    await scan(page, path, found)
  }

  await page.goto("/practice")
  await page.getByRole("button", { name: /^A\./ }).click()
  await expect(page.getByText(/^(?:CORRECT|INCORRECT) — EXPLANATION$/)).toBeVisible()
  await scan(page, "/practice (answered)", found)

  await page.goto("/progress")
  await page.getByRole("button", { name: "Open menu" }).click()
  await scan(page, "/progress (menu open)", found)

  await page.goto("/")
  await page.locator("header button[aria-controls='saving-panel']").click()
  await expect(page.locator("#saving-panel")).toBeVisible()
  await scan(page, "/ (saving panel open)", found)

  await openVoice(page)
  await scan(page, "/voice", found)

  expect(found, "WCAG 2.1 A/AA violations").toEqual([])
})

// Its own test, because the wider error filter that offline needs must not hide a failed request in the online scans above.
test.describe("offline", () => {
  test.use({ offlineNetwork: true })

  test("the voice quiz keeps an answer on the device with no WCAG 2.1 AA violation axe can detect", async ({ context, page }) => {
    const found: string[] = []
    await openVoice(page)
    // The Mac cannot be reached, so the answer is kept on the device and the page says so.
    await context.setOffline(true)
    await page.getByRole("button", { name: /^A\./ }).click()
    await expect(page.getByText(/kept on this device until the Mac can be reached/)).toBeVisible()
    await scan(page, "/voice (offline, answer kept on this device)", found)
    await context.setOffline(false)
    expect(found, "WCAG 2.1 A/AA violations").toEqual([])
  })
})
