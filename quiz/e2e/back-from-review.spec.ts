import { test, expect } from "./fixtures"

// In the installed app, Back from a reviewed exam returns to Progress at the same scroll, not to Home.
// The Review link moves inside the app (no page load), so Back goes back in history.
test("Back from an exam review returns to Progress at the same scroll", async ({ page, baseURL }) => {
  await page.context().addInitScript(() => {
    Object.defineProperty(navigator, "standalone", { value: true, configurable: true })
  })
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
  const saved = await page.request.post("/api/scores", { headers: { origin: baseURL! }, data: { answers: exams } })
  expect(await saved.json()).toMatchObject({ ok: true, rejected: [] })

  await page.goto("/progress")
  const last = page.getByRole("link", { name: "Review →" }).last()
  await last.scrollIntoViewIfNeeded()
  const scrollBefore = await page.evaluate(() => window.scrollY)
  expect(scrollBefore).toBeGreaterThan(0)

  await last.click()
  await expect(page).toHaveURL(/\/exam#/)
  await page.getByLabel("Back", { exact: true }).click()
  await expect(page).toHaveURL(/\/progress$/)
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(scrollBefore - 5)

  // The button sits 2rem from the left and bottom edges.
  const box = await page.getByLabel("Back", { exact: true }).boundingBox()
  const viewport = page.viewportSize()!
  expect(box!.x).toBeCloseTo(32, 0)
  expect(viewport.height - (box!.y + box!.height)).toBeCloseTo(32, 0)
})
