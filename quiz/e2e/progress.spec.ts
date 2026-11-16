import { test, expect, answerPractice } from "./fixtures"

test("Progress displays a saved answer and reset clears scratch scores", async ({ page }) => {
  const saved = page.waitForResponse((response) => response.url().endsWith("/api/scores") && response.request().method() === "POST")
  await answerPractice(page)
  expect((await saved).ok()).toBe(true)
  await page.goto("/progress")
  const table = page.locator("table").filter({ has: page.getByRole("cell", { name: "All", exact: true }) })
  await expect(table.getByRole("row").last().getByRole("cell").nth(1)).toHaveText(/^1\//)
  await page.waitForLoadState("networkidle")
  // The exam package is shown above Reset progress, and without its internal id.
  const packageBox = await page.getByText("EXAM PACKAGE", { exact: true }).boundingBox()
  const resetBox = await page.getByRole("button", { name: "Reset progress", exact: true }).boundingBox()
  expect(packageBox!.y).toBeLessThan(resetBox!.y)
  await expect(page.getByRole("cell", { name: "Id", exact: true })).toHaveCount(0)
  await page.getByRole("button", { name: "Reset progress", exact: true }).click()
  // The question names the exam being reset, so nobody clears the wrong one.
  await expect(page.getByRole("alertdialog").getByRole("heading")).toHaveText("Reset all progress for Generative AI Leader?")
  await expect(page.getByRole("alertdialog")).toContainText("Every Voice Quiz, Practice, Exam, Flashcards and Read Aloud result for Generative AI Leader is cleared")
  const reset = page.waitForResponse("**/api/scores/reset")
  const reloaded = page.waitForEvent("framenavigated", (frame) => frame === page.mainFrame())
  await page.getByRole("alertdialog").getByRole("button", { name: "Reset progress", exact: true }).click()
  const response = await reset
  expect(response.ok()).toBe(true)
  expect(await response.json()).toMatchObject({ ok: true })
  await expect(page.getByRole("status").filter({ hasText: "Progress has been reset." })).toBeVisible()
  await reloaded
  await expect(table.getByRole("row").last().getByRole("cell").nth(1)).toHaveText(/^0\//)
  const cleared = await page.request.get("/api/snapshot")
  expect(await cleared.json()).toMatchObject({ ok: true, snapshot: { lines: [] } })
})
