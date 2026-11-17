import type { Page } from "@playwright/test"
import { test, expect } from "./fixtures"

// One layout for every page (owner, 17 Nov): the same header, fixed at the top while the page scrolls, the breadcrumb fixed
// right under it where a page has one, and the same container, margins and text size. Run at 375 px and at 1280 px.
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
