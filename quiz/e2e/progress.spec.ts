import { test, expect, answerPractice } from "./fixtures"

test("Progress displays a saved answer and reset clears scratch scores", async ({ page }) => {
  const saved = page.waitForResponse((response) => response.url().endsWith("/api/scores") && response.request().method() === "POST")
  await answerPractice(page)
  expect((await saved).ok()).toBe(true)
  await page.goto("/progress")
  const table = page.locator("table").filter({ has: page.getByRole("cell", { name: "All", exact: true }) })
  await expect(table.getByRole("row").last().getByRole("cell").nth(1)).toHaveText(/^1\//)
  await page.waitForLoadState("networkidle")
  await page.getByRole("button", { name: "Reset progress", exact: true }).click()
  const reset = page.waitForResponse("**/api/scores/reset")
  const reloaded = page.waitForEvent("framenavigated", (frame) => frame === page.mainFrame())
  await page.getByRole("alertdialog").getByRole("button", { name: "Reset progress", exact: true }).click()
  const response = await reset
  expect(response.ok()).toBe(true)
  expect(await response.json()).toMatchObject({ ok: true })
  await expect(page.getByRole("status").filter({ hasText: "Progress reset." })).toBeVisible()
  await reloaded
  await expect(table.getByRole("row").last().getByRole("cell").nth(1)).toHaveText(/^0\//)
  const cleared = await page.request.get("/api/snapshot")
  expect(await cleared.json()).toMatchObject({ ok: true, snapshot: { lines: [] } })
})
