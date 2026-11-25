import type { Page } from "@playwright/test"
import { test, expect, answerPractice } from "./fixtures"

// One Previous and Next pair in every section (owner, 17 Nov): the same size everywhere, Previous left, Next right.
async function pair(page: Page, kind: string) {
  const nav = page.getByRole("navigation", { name: `Previous and next ${kind}` }).first()
  await expect(nav, `${kind}: the pair is on the page`).toBeVisible()
  const previous = nav.locator('[aria-label^="Previous"]').first()
  const next = nav.locator('[aria-label^="Next"]').first()
  const measure = (el: typeof previous) => el.evaluate((node) => {
    const box = node.getBoundingClientRect()
    const style = getComputedStyle(node)
    return { height: Math.round(box.height), left: Math.round(box.left), fontSize: style.fontSize, fontWeight: style.fontWeight, text: getComputedStyle(node.querySelector("[data-step-label]")!, "::before").content.replace(/"/g, "") }
  })
  return { previous: await measure(previous), next: await measure(next), nav }
}

const PLACES: { path: string; kind: string; prepare?: (page: Page) => Promise<void> }[] = [
  { path: "", kind: "section" },
  { path: "", kind: "topic" },
  { path: "/practice", kind: "question", prepare: (page) => answerPractice(page) },
  { path: "/flashcards", kind: "card", prepare: async (page) => { await page.getByRole("button", { name: /START SESSION/ }).click() } },
]

for (const [name, viewport, prevText] of [["a phone", { width: 375, height: 844 }, "Prev"], ["a desktop", { width: 1280, height: 800 }, "Previous"]] as const) {
  test(`every section has the same Previous and Next pair on ${name}`, async ({ page }) => {
    await page.setViewportSize(viewport)
    const seen: { kind: string; height: number; fontSize: string; fontWeight: string }[] = []
    // A section and a topic that each have one before and one after, so both halves show.
    await page.goto("/study")
    await page.waitForSelector('[data-page-ready="true"]')
    const hrefs = await page.locator('main a[href^="/study/"]').evaluateAll((links) => links.map((link) => (link as HTMLAnchorElement).getAttribute("href")!))
    const topics = [...new Set(hrefs.filter((href) => href.split("/").length === 4))]
    const sectionIds = [...new Set(topics.map((href) => href.split("/")[2]))]
    expect(sectionIds.length, "Study has at least three sections").toBeGreaterThan(2)
    const middle = topics.filter((href) => href.split("/")[2] === sectionIds[0])[1]
    const where: Record<string, string> = { section: `/study/${sectionIds[1]}`, topic: middle }
    for (const place of PLACES) {
      await page.goto(where[place.kind] ?? place.path)
      await page.waitForSelector('[data-page-ready="true"]')
      await place.prepare?.(page)
      const { previous, next } = await pair(page, place.kind)
      // Where the content is long the pair is at the top and at the bottom; a flashcard is short, so it has one.
      expect(await page.getByRole("navigation", { name: `Previous and next ${place.kind}` }).count(), `${place.kind}: pairs on the page`).toBe(place.kind === "card" ? 1 : 2)
      expect(next.text, `${place.kind}: Next reads the same everywhere`).toBe("Next")
      expect(previous.left, `${place.kind}: Previous is on the left of Next`).toBeLessThan(next.left)
      expect(previous.height, `${place.kind}: both halves are as tall`).toBe(next.height)
      seen.push({ kind: place.kind, ...previous })
      if (place.kind !== "section" && place.kind !== "topic") expect(previous.text, `${place.kind}: Previous label`).toBe(prevText)
    }
    for (const entry of seen) {
      expect(entry.height, `${entry.kind}: height`).toBe(seen[0].height)
      expect(entry.fontSize, `${entry.kind}: font size`).toBe(seen[0].fontSize)
      expect(entry.fontWeight, `${entry.kind}: font weight`).toBe(seen[0].fontWeight)
    }
  })
}

test("Previous reads Prev below 640 px and Previous from 640 px", async ({ page }) => {
  await page.goto("/study")
  await page.waitForSelector('[data-page-ready="true"]')
  const hrefs = await page.locator('main a[href^="/study/"]').evaluateAll((links) => links.map((link) => (link as HTMLAnchorElement).getAttribute("href")!))
  await page.goto(`/study/${[...new Set(hrefs.map((href) => href.split("/")[2]))][1]}`)
  for (const [width, label] of [[639, "Prev"], [640, "Previous"]] as const) {
    await page.setViewportSize({ width, height: 800 })
    const { previous } = await pair(page, "section")
    expect(previous.text, `${width} px`).toBe(label)
  }
})
