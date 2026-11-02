import { test, expect, openVoice } from "./fixtures"

test("Voice answer shows feedback and saves through the real scores endpoint", async ({ page }) => {
  await openVoice(page)
  const saved = page.waitForResponse((response) =>
    response.url().endsWith("/api/scores") && response.request().method() === "POST",
  )
  await page.getByRole("button", { name: /^A\./ }).click()
  expect((await saved).ok()).toBe(true)
  await expect(page.getByRole("button", { name: /^A\./ })).toBeDisabled()
  await expect(page.locator("main p[role=status]").filter({ hasText: /^(?:Correct\.|Incorrect\. The answer is)/ })).toBeVisible()
  const response = await page.request.get("/api/snapshot")
  expect(await response.json()).toMatchObject({
    ok: true, snapshot: { lines: [expect.objectContaining({ mode: "round", asked: [expect.any(String)] })] },
  })
})
