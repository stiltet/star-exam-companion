import { test, expect, answerPractice } from "./fixtures"

test("Practice explains the answer and moves to the next question", async ({ page }) => {
  await answerPractice(page)
  await page.getByRole("button", { name: /NEXT/ }).click()
  await expect(page.getByText(/^Question 2 of /)).toBeVisible()
  await expect(page.getByRole("button", { name: /^A\./ })).toBeEnabled()
})

test("Flashcards reveal a definition and record a known card", async ({ page }) => {
  await page.goto("/flashcards")
  await page.getByRole("button", { name: /START SESSION/ }).click()
  await page.getByText("CLICK TO REVEAL", { exact: true }).click()
  await expect(page.getByText("CLICK TO HIDE", { exact: true })).toBeVisible()
  await page.getByRole("button", { name: "KNOW ✓", exact: true }).click()
  await expect(page.getByText(/^Card 2 \//)).toBeVisible()
  await expect(page.getByText(/^Known: 1 /)).toBeVisible()
})

test("Glossary category links lead to their terms", async ({ page }) => {
  await page.goto("/glossary")
  const category = page.locator('main a[href^="#"]').first()
  const href = await category.getAttribute("href")
  if (!href) throw new Error("Glossary category has no anchor")
  await category.click()
  await expect.poll(() => new URL(page.url()).hash).toBe(new URL(href, page.url()).hash)
  await expect(page.locator(`[id="${href.slice(1)}"]`)).toBeVisible()
})

test("Read Aloud opens a course and turns to its next reading", async ({ page }) => {
  await page.goto("/read")
  await page.locator('main a[href^="/read/"]').filter({ hasNotText: /night/i }).first().click()
  await page.getByRole("link", { name: /Test reading one/ }).click()
  await expect(page.locator("main")).toContainText("This is original test text")
  await page.locator('main a[href$="/e2e-second"]').first().click()
  await expect(page.locator("main")).toContainText("This is the second original test paragraph")
})

test("Practice exam resumes its answer, submits and saves a review", async ({ page }) => {
  await page.goto("/exam")
  await page.getByRole("button", { name: /START.*EXAM/i }).click()
  const choice = page.getByRole("button", { name: /^A\./ })
  await choice.click()
  await page.waitForLoadState("networkidle")
  await page.reload()
  await expect(page.getByRole("button", { name: /^A\./ })).toHaveAttribute("aria-pressed", "true")
  await page.getByRole("button", { name: "End exam", exact: true }).click()
  const saved = page.waitForResponse((response) =>
    response.url().endsWith("/api/scores") && response.request().method() === "POST",
  )
  await page.getByRole("dialog").getByRole("button", { name: "Submit", exact: true }).click()
  expect((await saved).ok()).toBe(true)
  await expect(page.getByRole("heading", { name: "EXAM RESULTS", exact: true })).toBeVisible()
  const response = await page.request.get("/api/snapshot")
  const body = await response.json()
  expect(body).toMatchObject({ ok: true, snapshot: { lines: [expect.objectContaining({ mode: "exam" })] } })
  expect(Object.keys(body.snapshot.lines[0].answers)).toHaveLength(1)
})

test("Practice section and unanswered filters keep saved answers out", async ({ page }) => {
  await page.goto("/practice")
  await page.locator('main a[href="/practice?section=1"]').click()
  await expect(page).toHaveURL(/section=1$/)
  const question = await page.locator("main p.font-medium").textContent()
  if (!question) throw new Error("Filtered practice has no question")
  const saved = page.waitForResponse((response) => response.url().endsWith("/api/scores") && response.request().method() === "POST")
  await page.getByRole("button", { name: /^A\./ }).click()
  expect((await saved).ok()).toBe(true)
  await page.getByRole("link", { name: "UNANSWERED", exact: true }).click()
  await expect(page).toHaveURL(/section=1&unanswered=1$/)
  await expect(page.locator("main p.font-medium")).not.toHaveText(question)
})

test("Study topic opens its filtered practice questions", async ({ page }) => {
  await page.goto("/study/fundamentals/gemini-vs-gemma")
  await page.locator('main a[href^="/practice?topic="]').click()
  await expect(page).toHaveURL(/\/practice\?topic=gemini-vs-gemma$/)
  await expect(page.getByRole("button", { name: /^A\./ })).toBeEnabled()
})
