import type { Page } from "@playwright/test"
import { test, expect } from "./fixtures"

// A review opens at its top, however far down Progress or the Test exam page was when its Review link was tapped, and an address
// that names two reviews opens the last one.
async function saveExams(page: Page, origin: string): Promise<string[]> {
  // Real question ids, since the server refuses an exam that asks one it does not know.
  const snapshot = (await (await page.request.get("/api/snapshot")).json()) as { snapshot: { items: { id: string }[] } }
  const [first, second] = snapshot.snapshot.items.map((item) => item.id)
  const exams = Array.from({ length: 14 }, (_, index) => ({
    id: crypto.randomUUID(),
    at: new Date(Date.UTC(2026, 0, 1 + index)).toISOString(),
    mode: "exam",
    asked: [first, second],
    missed: [first],
    seconds: 60,
  }))
  const saved = await page.request.post("/api/scores", { headers: { origin }, data: { answers: exams } })
  expect(await saved.json()).toMatchObject({ ok: true, rejected: [] })
  return exams.map((exam) => exam.id)
}

const results = (page: Page) => page.getByRole("heading", { name: "RESULTS", exact: true })

test.describe("opening a review", () => {
  test("from Progress, scrolled down the table, shows the top of the review", async ({ page, baseURL }) => {
    await saveExams(page, baseURL!)
    await page.goto("/progress")
    const link = page.getByRole("link", { name: "Review →" }).nth(8)
    await link.scrollIntoViewIfNeeded()
    expect(await page.evaluate(() => window.scrollY), "the table is scrolled down before the click").toBeGreaterThan(300)
    await link.click()
    await expect(results(page)).toBeVisible()
    await expect.poll(() => page.evaluate(() => window.scrollY), { message: "the review starts at the top" }).toBe(0)
  })

  test("from the Test exam page, scrolled down the list, shows the top of the review", async ({ page, baseURL }) => {
    await saveExams(page, baseURL!)
    await page.goto("/exam")
    const link = page.getByRole("link", { name: "Review →" }).nth(8)
    await link.scrollIntoViewIfNeeded()
    expect(await page.evaluate(() => window.scrollY), "the list is scrolled down before the click").toBeGreaterThan(300)
    await link.click()
    await expect(results(page)).toBeVisible()
    await expect.poll(() => page.evaluate(() => window.scrollY), { message: "the review starts at the top" }).toBe(0)
  })

  test("the title is RESULTS alone, since the header already says Test exam", async ({ page, baseURL }) => {
    await saveExams(page, baseURL!)
    await page.goto("/exam")
    await page.getByRole("link", { name: "Review →" }).first().click()
    await expect(results(page)).toBeVisible()
    await expect(page.getByRole("heading", { name: /test exam results/i })).toHaveCount(0)
  })

  test("an address that names an exam not on the device is titled RESULTS, not Test exam results", async ({ page }) => {
    await page.goto(`/exam#review=${crypto.randomUUID()}`)
    await expect(page.getByText("is not on this device yet")).toBeVisible()
    await expect(results(page)).toBeVisible()
    await expect(page.getByRole("heading", { name: /test exam results/i })).toHaveCount(0)
  })

  test("an address that names two reviews opens the last one and is made single", async ({ page, baseURL }) => {
    const ids = await saveExams(page, baseURL!)
    await page.goto(`/exam#review=${ids[0]}#review=${ids[1]}`)
    await expect(results(page)).toBeVisible()
    await expect(page.getByText("is not on this device yet")).toHaveCount(0)
    await expect.poll(() => new URL(page.url()).hash).toBe(`#review=${ids[1]}`)
    await page.reload()
    await expect(results(page)).toBeVisible()
  })
})
