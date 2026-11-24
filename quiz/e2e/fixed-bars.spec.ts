import { test, expect, openVoice } from "./fixtures"

// What the owner saw on the phone (17 to 24 Nov): the Voice quiz's section name is centred whether or not there is a section on
// each side, and the Test exam's timer is one strip under the header, with one line below it.

test("the Voice quiz keeps its section name in the middle and its Next buttons one size, the size every section uses", async ({ page }) => {
  await openVoice(page)
  const heading = page.locator("main h2").filter({ hasText: /^Section|^Questions/ }).first()
  await expect(heading).toBeVisible()
  const { centre, viewport } = await heading.evaluate((el) => ({ centre: el.getBoundingClientRect().left + el.getBoundingClientRect().width / 2, viewport: document.documentElement.clientWidth }))
  expect(Math.abs(centre - viewport / 2), "the name is in the middle when only one side has a section").toBeLessThanOrEqual(2)
  const size = (name: RegExp | string) => page.getByRole("button", { name, exact: typeof name === "string" }).or(page.getByRole("link", { name })).first().evaluate((el) => {
    const b = el.getBoundingClientRect()
    return { w: Math.round(b.width), h: Math.round(b.height), font: getComputedStyle(el).fontSize, weight: getComputedStyle(el).fontWeight, pad: getComputedStyle(el).padding }
  })
  const section = await size("Next section")
  expect(section, "the two Next buttons are one size").toEqual(await size("Next"))
  await page.goto("/study")
  await page.locator('a[href^="/study/"]').first().click()
  await page.waitForLoadState("networkidle")
  const other = await size(/^Next /)
  expect({ h: other.h, font: other.font, weight: other.weight, pad: other.pad }, "Previous and Next in the other sections are the Voice quiz's size").toEqual({ h: section.h, font: section.font, weight: section.weight, pad: section.pad })
})

test("the Test exam timer is one strip under the header with one line below it", async ({ page }) => {
  await page.goto("/exam")
  await page.getByRole("button", { name: /START.*EXAM/i }).click()
  await page.waitForTimeout(400)
  const strip = page.locator('[role="timer"]').locator("xpath=ancestor::div[contains(@class,'sticky')]")
  const gap = await strip.evaluate((el) => Math.round(el.getBoundingClientRect().top - document.querySelector("header")!.getBoundingClientRect().bottom))
  expect(gap, "the strip touches the header").toBe(0)
  expect(await strip.evaluate((el) => getComputedStyle(el).borderBottomWidth), "the same 2px border as the header").toBe("2px")
  expect(await strip.locator("div.h-0\\.5").count(), "no partial line").toBe(0)
})

test("a Flashcards session shows the section in the fixed breadcrumb only", async ({ page }) => {
  await page.goto("/flashcards")
  await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toHaveCount(0)
  const categories = page.locator("main button").filter({ hasText: /\(\d+\)\s*$/ })
  await categories.nth(1).click()
  const section = (await categories.nth(1).textContent())!.replace(/\s*\(\d+\)\s*$/, "").trim()
  await page.getByRole("button", { name: /START SESSION/ }).click()
  const crumb = page.getByRole("navigation", { name: "Breadcrumb" })
  await expect(crumb).toContainText("FLASHCARDS")
  await expect(crumb).toContainText(section.toUpperCase())
  await expect(page.getByRole("heading", { level: 2, name: section }), "the breadcrumb is the only title").toHaveCount(0)
  await page.evaluate(() => window.scrollTo(0, 300))
  const gap = await crumb.evaluate((el) => Math.round(el.getBoundingClientRect().top - document.querySelector("header")!.getBoundingClientRect().bottom))
  expect(gap, "the bar is under the header").toBeLessThanOrEqual(12)
  await page.getByRole("button", { name: "FLASHCARDS", exact: true }).click()
  await expect(page.getByRole("button", { name: /START SESSION/ })).toBeVisible()
})
