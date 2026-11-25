import type { Page } from "@playwright/test"
import { test, expect, readyOffline } from "./fixtures"

// In the installed app, Back from a reviewed exam returns to Progress at the same scroll, not to Home.
// The Review link moves inside the app (no page load), so Back goes back in history.
const standalone = () => {
  Object.defineProperty(navigator, "standalone", { value: true, configurable: true })
}

async function saveExams(page: Page, origin: string) {
  // Real question ids, since the server refuses an exam that asks one it does not know.
  const snapshot = (await (await page.request.get("/api/snapshot")).json()) as { snapshot: { items: { id: string }[] } }
  const [first, second] = snapshot.snapshot.items.map((item) => item.id)
  const exams = Array.from({ length: 12 }, (_, index) => ({
    id: crypto.randomUUID(),
    at: new Date(Date.UTC(2026, 0, 1 + index)).toISOString(),
    mode: "exam",
    asked: [first, second],
    missed: [first],
    seconds: 60,
  }))
  const saved = await page.request.post("/api/scores", { headers: { origin }, data: { answers: exams } })
  expect(await saved.json()).toMatchObject({ ok: true, rejected: [] })
}

const backButton = (page: Page) => page.getByLabel("Back", { exact: true })

async function waitForScrollToSettle(page: Page) {
  await page.evaluate(() => new Promise<void>((resolve) => {
    let lastY = window.scrollY
    let stillSince = performance.now()
    const check = () => {
      if (window.scrollY !== lastY) {
        lastY = window.scrollY
        stillSince = performance.now()
      }
      if (performance.now() - stillSince >= 200) resolve()
      else requestAnimationFrame(check)
    }
    requestAnimationFrame(check)
  }))
}

test.describe("in the installed app", () => {
  test.beforeEach(async ({ page }) => {
    await page.context().addInitScript(standalone)
  })

  test("Back from an exam review returns to Progress at the same scroll", async ({ page, baseURL }) => {
    await saveExams(page, baseURL!)
    await page.goto("/progress")
    await expect(backButton(page)).toBeVisible()
    const last = page.getByRole("link", { name: "Review →" }).last()
    await last.scrollIntoViewIfNeeded()
    await waitForScrollToSettle(page)
    const scrollBefore = await page.evaluate(() => window.scrollY)
    expect(scrollBefore).toBeGreaterThan(0)

    await last.click()
    await expect(page).toHaveURL(/\/exam#/)
    await expect(page.getByRole("heading", { name: "TEST EXAM RESULTS" })).toBeVisible()
    await backButton(page).click()
    await expect(page).toHaveURL(/\/progress$/)
    await expect.poll(async () => Math.abs((await page.evaluate(() => window.scrollY)) - scrollBefore)).toBeLessThanOrEqual(5)
  })

  test("Back from a review returns to Progress when Progress was reached by the menu, and Back again returns to where it came from", async ({ page, baseURL }) => {
    await saveExams(page, baseURL!)
    await page.goto("/study")
    await page.getByRole("button", { name: "Open menu" }).click()
    await page.getByRole("link", { name: "PROGRESS", exact: true }).click()
    await expect(page).toHaveURL(/\/progress$/)
    await page.getByRole("link", { name: "Review →" }).first().click()
    await expect(page).toHaveURL(/\/exam#/)
    await expect(page.getByRole("heading", { name: "TEST EXAM RESULTS" })).toBeVisible()
    await backButton(page).click()
    await expect(page, "Back from a review is Progress, never Home").toHaveURL(/\/progress$/)
    await backButton(page).click()
    await expect(page).toHaveURL(/\/study$/)
  })

  test("Back from a review returns to Progress after a second review was opened", async ({ page, baseURL }) => {
    await saveExams(page, baseURL!)
    await page.goto("/progress")
    await page.getByRole("link", { name: "Review →" }).nth(1).click()
    await expect(page).toHaveURL(/\/exam#/)
    await expect(page.getByRole("heading", { name: "TEST EXAM RESULTS" })).toBeVisible()
    await backButton(page).click()
    await expect(page).toHaveURL(/\/progress$/)
    await page.getByRole("link", { name: "Review →" }).nth(2).click()
    await expect(page.getByRole("heading", { name: "TEST EXAM RESULTS" })).toBeVisible()
    await backButton(page).click()
    await expect(page).toHaveURL(/\/progress$/)
  })

  test("Back from a review opened on the Test exam page stays inside the app, never Home", async ({ page, baseURL }) => {
    await saveExams(page, baseURL!)
    await page.goto("/exam")
    await page.getByRole("link", { name: "Review →" }).first().click()
    await expect(page.getByRole("heading", { name: "TEST EXAM RESULTS" })).toBeVisible()
    await backButton(page).click()
    await expect(page, "Back from a review is the Test exam page: not Home, and not still the review").toHaveURL(/\/exam$/)
  })

  test("Back after a glossary section link returns to the top of the glossary, not Home", async ({ page }) => {
    await page.goto("/glossary")
    await page.waitForSelector('[data-page-ready="true"]')
    await page.locator('main a[href^="#"]').nth(2).click()
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(100)
    await backButton(page).click()
    await expect(page).toHaveURL(/\/glossary$/)
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(5)
  })

  test("Back after tapping the same-page link twice stays on the page", async ({ page }) => {
    await page.goto("/glossary")
    await page.waitForSelector('[data-page-ready="true"]')
    const link = page.locator('main a[href^="#"]').nth(2)
    await link.click()
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(100)
    await link.click()
    await backButton(page).click()
    await expect(page, "a link to the place already shown made no step, so Back does not leave").toHaveURL(/\/glossary#section-/)
  })

  test("Back after links to two glossary sections undoes them one at a time and never leaves the glossary", async ({ page }) => {
    await page.goto("/glossary")
    await page.waitForSelector('[data-page-ready="true"]')
    const links = page.locator('main a[href^="#"]')
    const first = await links.nth(2).getAttribute("href")
    await links.nth(2).click()
    await expect(page).toHaveURL(new RegExp(`/glossary${first}$`))
    await links.nth(4).click()
    await expect(page).not.toHaveURL(new RegExp(`/glossary${first}$`))
    await backButton(page).click()
    await expect(page, "the first Back undoes the second link").toHaveURL(new RegExp(`/glossary${first}$`))
    await page.waitForTimeout(600)
    await backButton(page).click()
    await expect(page, "the second Back undoes the first link and stays on the glossary").toHaveURL(/\/glossary$/)
  })

  test("a quick second tap on Back after a section link is one Back, not two", async ({ page }) => {
    await page.goto("/glossary")
    await page.waitForSelector('[data-page-ready="true"]')
    await page.locator('main a[href^="#"]').nth(2).click()
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(100)
    // Both taps arrive before the step back has finished, however busy the machine is.
    await backButton(page).evaluate((button) => { (button as HTMLElement).click(); (button as HTMLElement).click() })
    await page.waitForTimeout(1500)
    await expect(page, "one step back, still on the glossary").toHaveURL(/\/glossary$/)
  })

  test("a second tap on Back while the step back over a section link is still on its way is the same Back", async ({ page }) => {
    // A slow device: the step back arrives well after the second tap.
    await page.addInitScript(() => {
      const back = window.history.back.bind(window.history)
      window.history.back = () => void window.setTimeout(back, 3000)
    })
    await page.goto("/glossary")
    await page.waitForSelector('[data-page-ready="true"]')
    await page.locator('main a[href^="#"]').nth(2).click()
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(100)
    await backButton(page).click()
    await page.waitForTimeout(700)
    await backButton(page).evaluate((button) => (button as HTMLElement).click())
    await page.waitForTimeout(1500)
    await expect(page, "the second tap did not start another move").toHaveURL(/\/glossary#section-/)
    await page.waitForTimeout(2500)
    await expect(page, "one step back, still on the glossary").toHaveURL(/\/glossary$/)
  })

  test("the Back button sits 2rem from the left and bottom edges", async ({ page }) => {
    await page.goto("/progress")
    const box = await backButton(page).boundingBox()
    const viewport = page.viewportSize()!
    expect(box!.x).toBeCloseTo(32, 0)
    expect(viewport.height - (box!.y + box!.height)).toBeCloseTo(32, 0)
  })

  test("Back on a page opened directly goes up one level", async ({ page }) => {
    await page.goto("/study/fundamentals")
    await backButton(page).click()
    await expect(page).toHaveURL(/\/study$/)
  })

  test.describe("with the Mac unreachable", () => {
    test.use({ offlineNetwork: true })

    test("Back from an exam review returns to Progress", async ({ context, page, baseURL }) => {
      await saveExams(page, baseURL!)
      await page.goto("/progress")
      await readyOffline(page)
      await page.waitForLoadState("networkidle")
      await expect(page.getByRole("link", { name: "Review →" }).first()).toBeVisible()
      await context.setOffline(true)
      await page.getByRole("link", { name: "Review →" }).last().click()
      await expect(page).toHaveURL(/\/exam#/)
      await expect(page.getByRole("heading", { name: "TEST EXAM RESULTS" })).toBeVisible()
      await backButton(page).click()
      await expect(page).toHaveURL(/\/progress$/)
    })
  })
})

test("a browser tab keeps native history scroll and shows no floating Back button", async ({ page, baseURL }) => {
  await saveExams(page, baseURL!)
  await page.goto("/")

  await page.getByRole("button", { name: "Open menu" }).click()
  await page.getByRole("link", { name: "PROGRESS", exact: true }).click()
  await expect(page).toHaveURL(/\/progress$/)
  await page.getByRole("button", { name: "Open menu" }).click()
  await page.getByRole("link", { name: "STUDY", exact: true }).click()
  await expect(page).toHaveURL(/\/study$/)
  await page.getByRole("button", { name: "Open menu" }).click()
  await page.getByRole("link", { name: "PROGRESS", exact: true }).click()
  await expect(page).toHaveURL(/\/progress$/)

  const maxScroll = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight)
  expect(maxScroll).toBeGreaterThan(200)
  await page.evaluate(() => window.scrollTo(0, 200))
  const laterPosition = await page.evaluate(() => window.scrollY)
  expect(laterPosition).toBe(200)

  await page.goBack()
  await expect(page).toHaveURL(/\/study$/)
  await page.goBack()
  await expect(page).toHaveURL(/\/progress$/)
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(5)
  await expect(backButton(page)).toHaveCount(0)
})
