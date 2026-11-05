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

test.describe("in the installed app", () => {
  test.beforeEach(async ({ page }) => {
    await page.context().addInitScript(standalone)
  })

  test("Back from an exam review returns to Progress at the same scroll", async ({ page, baseURL }) => {
    await saveExams(page, baseURL!)
    await page.goto("/progress")
    const last = page.getByRole("link", { name: "Review →" }).last()
    await last.scrollIntoViewIfNeeded()
    const scrollBefore = await page.evaluate(() => window.scrollY)
    expect(scrollBefore).toBeGreaterThan(0)

    await last.click()
    await expect(page).toHaveURL(/\/exam#/)
    await expect(page.getByRole("heading", { name: "EXAM RESULTS" })).toBeVisible()
    await backButton(page).click()
    await expect(page).toHaveURL(/\/progress$/)
    await expect.poll(async () => Math.abs((await page.evaluate(() => window.scrollY)) - scrollBefore)).toBeLessThanOrEqual(5)
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
      await expect(page.getByRole("heading", { name: "EXAM RESULTS" })).toBeVisible()
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
