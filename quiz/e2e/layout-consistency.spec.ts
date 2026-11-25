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

test("a long study topic title cannot make the fixed breadcrumb taller than two lines", async ({ page }) => {
  await page.goto("/study")
  await page.waitForSelector('[data-page-ready="true"]')
  const links = await page.locator('main a[href^="/study/"]').evaluateAll((all) => all.map((link) => ({ href: (link as HTMLAnchorElement).getAttribute("href")!, text: link.textContent ?? "" })).filter((link) => link.href.split("/").length === 4))
  await page.goto(links.sort((a, b) => b.text.length - a.text.length)[0].href)
  const crumb = page.getByRole("navigation", { name: "Breadcrumb" })
  const { height, line } = await crumb.evaluate((el) => ({ height: el.getBoundingClientRect().height, line: parseFloat(getComputedStyle(el).lineHeight) }))
  expect(height, "at most two lines").toBeLessThanOrEqual(line * 2 + 1)
})

test("the breadcrumb follows a move from one study topic to the next", async ({ page }) => {
  await page.goto("/study")
  await page.waitForSelector('[data-page-ready="true"]')
  const links = await page.locator('main a[href^="/study/"]').evaluateAll((all) => all.map((link) => (link as HTMLAnchorElement).getAttribute("href")!).filter((href) => href.split("/").length === 4))
  await page.goto(links[0])
  await page.waitForSelector('[data-page-ready="true"]')
  await page.getByRole("link", { name: /^Next topic/ }).first().click()
  await expect(page).not.toHaveURL(new RegExp(`${links[0]}$`))
  const title = (await page.getByRole("heading", { level: 1 }).first().textContent())!.trim().toUpperCase()
  await expect(page.getByRole("navigation", { name: "Breadcrumb" }), "the new topic's title, not the one left").toContainText(title.slice(0, 24))
})

test("a Read Aloud paragraph scrolled into view lands below the fixed stack and the control bar", async ({ page }) => {
  await page.goto("/read")
  await page.locator('main a[href^="/read/"]').filter({ hasNotText: /night/i }).first().click()
  await page.getByRole("link", { name: /Test reading one/ }).click()
  const paragraph = page.locator("main button.block.w-full.text-left").first()
  await expect(paragraph).toBeVisible()
  const { top, stackBottom } = await paragraph.evaluate((el) => {
    const spacer = document.createElement("div")
    spacer.style.height = "3000px"
    document.querySelector("footer")!.before(spacer)
    el.scrollIntoView({ block: "start" })
    return { top: el.getBoundingClientRect().top, stackBottom: document.querySelector("[data-sticky-stack]")!.getBoundingClientRect().bottom }
  })
  expect(top - stackBottom, "room for the control bar between the stack and the paragraph").toBeGreaterThanOrEqual(84)
})
