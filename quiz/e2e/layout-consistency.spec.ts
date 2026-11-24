import type { Page } from "@playwright/test"
import { test, expect } from "./fixtures"

// One layout for every page (owner, 17 Nov), at 375 px and at 1280 px.
const PAGES = ["/", "/study", "/study/fundamentals", "/practice", "/exam", "/flashcards", "/voice", "/progress", "/glossary", "/read", "/about"]

type Measure = { path: string; headerHeight: number; headerTopAfterScroll: number; crumbTopMinusHeaderBottom: number | null; mainLeft: number; mainWidth: number; fontSize: string; fontFamily: string; scrolled: boolean }

async function measure(page: Page, path: string): Promise<Measure> {
  await page.goto(path)
  await page.waitForSelector('[data-page-ready="true"]')
  return page.evaluate(async (at) => {
    const stack = document.querySelector("[data-sticky-stack]") as HTMLElement
    const header = stack.querySelector("header") as HTMLElement
    const crumb = stack.querySelector('nav[aria-label="Breadcrumb"]')?.closest("div.border-b") as HTMLElement | null
    const main = document.querySelector("main") as HTMLElement
    // Pad the page so every page can scroll, then read the fixed stack where it has moved to.
    const spacer = document.createElement("div")
    spacer.style.height = "3000px"
    document.querySelector("footer")!.before(spacer)
    window.scrollTo(0, 1500)
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    const h = header.getBoundingClientRect()
    const m = main.getBoundingClientRect()
    const style = getComputedStyle(main)
    return {
      path: at,
      headerHeight: Math.round(h.height),
      headerTopAfterScroll: Math.round(h.top),
      crumbTopMinusHeaderBottom: crumb ? Math.round(crumb.getBoundingClientRect().top - h.bottom) : null,
      mainLeft: Math.round(m.left),
      mainWidth: Math.round(m.width),
      fontSize: style.fontSize,
      fontFamily: style.fontFamily,
      scrolled: window.scrollY > 0,
    }
  }, path)
}

for (const [name, viewport] of [["375 px", { width: 375, height: 844 }], ["1280 px", { width: 1280, height: 800 }]] as const) {
  test(`every page has the same fixed header, container and text at ${name}`, async ({ page }) => {
    await page.setViewportSize(viewport)
    const all: Measure[] = []
    for (const path of PAGES) all.push(await measure(page, path))
    const first = all[0]
    for (const m of all) {
      expect(m.scrolled, `${m.path} scrolls`).toBe(true)
      expect(m.headerTopAfterScroll, `${m.path}: the header stays at the top while scrolling`).toBe(0)
      if (m.crumbTopMinusHeaderBottom !== null) expect(Math.abs(m.crumbTopMinusHeaderBottom), `${m.path}: the breadcrumb sits right under the header`).toBeLessThanOrEqual(1)
      expect(m.headerHeight, `${m.path}: header height`).toBe(first.headerHeight)
      expect(m.mainLeft, `${m.path}: left margin`).toBe(first.mainLeft)
      expect(m.mainWidth, `${m.path}: container width`).toBe(first.mainWidth)
      expect(m.fontSize, `${m.path}: text size`).toBe(first.fontSize)
      expect(m.fontFamily, `${m.path}: font`).toBe(first.fontFamily)
    }
    expect(all.some((m) => m.crumbTopMinusHeaderBottom !== null), "at least one page has a breadcrumb").toBe(true)
  })
}

test("a glossary section link scrolls its section to just under the fixed header, not behind it", async ({ page }) => {
  await page.goto("/glossary")
  await page.waitForSelector('[data-page-ready="true"]')
  const links = page.locator('main a[href^="#"]')
  const count = await links.count()
  expect(count, "the glossary lists its sections").toBeGreaterThan(1)
  for (const index of [1, count - 1]) {
    const link = links.nth(index)
    const id = (await link.getAttribute("href"))!.slice(1)
    await link.click()
    await expect.poll(async () => page.evaluate(() => window.scrollY)).toBeGreaterThan(0)
    await page.waitForTimeout(400)
    const gap = await page.evaluate((anchor) => {
      const stack = document.querySelector("[data-sticky-stack]")!.getBoundingClientRect()
      const target = document.getElementById(anchor)!.getBoundingClientRect()
      return Math.round(target.top - stack.bottom)
    }, id)
    expect(gap, `${id} starts just under the fixed header`).toBeGreaterThanOrEqual(0)
    expect(gap, `${id} is not left far below it`).toBeLessThanOrEqual(40)
  }
})
