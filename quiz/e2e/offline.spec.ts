import { test, expect, readyOffline, openVoice } from "./fixtures"

test.use({ offlineNetwork: true })

test("Cached pages open with the server unreachable; queued answers sync once online", async ({ context, page }) => {
  await page.goto("/progress")
  await readyOffline(page)
  await context.setOffline(true)
  for (const path of ["/", "/exam", "/practice", "/flashcards", "/glossary", "/study", "/study/fundamentals", "/study/fundamentals/introduction", "/progress", "/read", "/read/1", "/read/1/e2e-first", "/read/night", "/about"]) {
    const response = await page.goto(path)
    expect(response?.status(), path).toBe(200)
    await expect(page.locator("h1")).not.toBeEmpty()
  }
  await page.goto("/practice")
  await page.getByRole("button", { name: /^A\./ }).click()
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("quiz-outbox") ?? "[]").length)).toBe(1)
  const queuedId: string = await page.evaluate(() => JSON.parse(localStorage.getItem("quiz-outbox") ?? "[]")[0].id)
  await page.reload()
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("quiz-outbox") ?? "[]").length)).toBe(1)
  await context.setOffline(false)
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("quiz-outbox") ?? "[]").length)).toBe(0)
  const response = await page.request.get("/api/snapshot")
  expect(await response.json()).toMatchObject({
    ok: true, snapshot: { lines: [expect.objectContaining({ id: queuedId, mode: "practice" })] },
  })
})

test("Voice quiz accepts an offline answer without reloading and sends it after reconnection", async ({ context, page }) => {
  await openVoice(page)
  await readyOffline(page)
  await context.setOffline(true)
  await page.getByRole("button", { name: /^A\./ }).click()
  await expect(page.getByRole("button", { name: /^A\./ })).toBeDisabled()
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("quiz-outbox") ?? "[]").length)).toBe(1)
  await context.setOffline(false)
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("quiz-outbox") ?? "[]").length)).toBe(0)
  const response = await page.request.get("/api/snapshot")
  expect(await response.json()).toMatchObject({
    ok: true, snapshot: { lines: [expect.objectContaining({ mode: "round" })] },
  })
})

test("Night reading stores a silent recording and reopens it offline", async ({ context, page }) => {
  await page.goto("/read/night")
  await page.getByRole("button", { name: /^Store on this device/ }).click()
  await expect(page.getByRole("button", { name: "Play", exact: true })).toBeVisible()
  await readyOffline(page)
  await context.setOffline(true)
  await page.reload()
  await page.getByRole("button", { name: "Play", exact: true }).click()
  await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeVisible()
  await expect(page.getByRole("status").filter({ hasText: "Test chapter" })).toBeVisible()
  await page.getByRole("button", { name: "Pause", exact: true }).click()
  await expect(page.getByRole("button", { name: "Play", exact: true })).toBeVisible()
})
