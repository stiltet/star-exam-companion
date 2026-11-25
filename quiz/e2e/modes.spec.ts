import type { Page } from "@playwright/test"
import { test, expect, answerPractice } from "./fixtures"

test("Practice explains the answer and moves to the next question", async ({ page }) => {
  await answerPractice(page)
  await page.getByRole("button", { name: /^Next question/ }).first().click()
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

test("Test exam resumes its answer, submits and saves a review", async ({ page }) => {
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
  await expect(page.getByRole("heading", { name: "RESULTS", exact: true })).toBeVisible()
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

// The section buttons that hold the fewest cards, so a test that steps to the last card takes a second, not ten.
async function smallestSection(page: Page, skipLast = false) {
  const buttons = page.locator("main button").filter({ hasText: /\(\d+\)\s*$/ })
  const counts = (await buttons.allTextContents()).map((text, index) => ({ index, count: Number(/\((\d+)\)\s*$/.exec(text)![1]) })).slice(1)
  const usable = skipLast ? counts.slice(0, -1) : counts
  return buttons.nth(usable.sort((a, b) => a.count - b.count)[0].index)
}

test("Flashcards: the last card can be marked known, and only then is the session complete", async ({ page }) => {
  await page.goto("/flashcards")
  await (await smallestSection(page)).click()
  await page.getByRole("button", { name: /START SESSION/ }).click()
  const total = Number((await page.getByText(/^Card 1 \/ \d+$/).textContent())!.split("/")[1])
  for (let card = 1; card < total; card += 1) await page.getByRole("button", { name: /^Next card/ }).click()
  await page.getByText(/CLICK TO REVEAL/).click()
  await expect(page.getByRole("button", { name: /KNOW ✓/ }), "the last card can be marked").toBeVisible()
  await expect(page.getByText("SESSION COMPLETE")).toHaveCount(0)
  await page.getByRole("button", { name: /KNOW ✓/ }).click()
  await expect(page.getByText("SESSION COMPLETE")).toBeVisible()
  await expect(page.getByText(new RegExp(`You marked 1 / ${total} cards as known`))).toBeVisible()
  // A reload after the last card is still a finished session, not an open one.
  await page.reload()
  await expect(page.getByText("SESSION COMPLETE"), "the finished session is restored as finished").toBeVisible()
})

test("Flashcards: Next on the last card of a section opens the next section's cards", async ({ page }) => {
  await page.goto("/flashcards")
  const categories = page.locator("main button").filter({ hasText: /\(\d+\)\s*$/ })
  expect(await categories.count(), "All and at least two sections").toBeGreaterThan(2)
  await (await smallestSection(page, true)).click()
  await page.getByRole("button", { name: /START SESSION/ }).click()
  const header = async () => (await page.getByText(/CLICK TO (REVEAL|HIDE)/).locator("xpath=preceding-sibling::span").textContent())!
  const first = await header()
  const total = Number((await page.getByText(/^Card 1 \/ \d+$/).textContent())!.split("/")[1])
  for (let card = 1; card < total; card += 1) await page.getByRole("button", { name: /^Next card/ }).first().click()
  const next = page.getByRole("button", { name: /^Next card/ }).first()
  await expect(next, "Next is on at the last card of a section").toBeEnabled()
  await next.click()
  await expect(page.getByText(/^Card 1 \/ \d+$/)).toBeVisible()
  expect(await header(), "the next section's cards").not.toBe(first)
})

test("Flashcards: Previous on the first card of a section opens the last card of the section before", async ({ page }) => {
  await page.goto("/flashcards")
  const categories = page.locator("main button").filter({ hasText: /\(\d+\)\s*$/ })
  const sectionName = async (index: number) => (await categories.nth(index).textContent())!.replace(/\s*\(\d+\)\s*$/, "").trim().toUpperCase()
  const before = await sectionName(1)
  const chosen = await sectionName(2)
  await categories.nth(2).click()
  await page.getByRole("button", { name: /START SESSION/ }).click()
  const crumb = page.locator("[data-crumb-bar]")
  await expect(crumb).toContainText(chosen)
  const previous = page.getByRole("button", { name: /^Previous card/ }).first()
  await expect(previous, "Previous is on at the first card of a later section").toBeEnabled()
  await previous.click()
  const position = (await page.getByText(/^Card \d+ \/ \d+$/).textContent())!.match(/(\d+) \/ (\d+)/)!
  expect(position[1], "it is the last card of the section before").toBe(position[2])
  await expect(crumb, "the breadcrumb names the section before, not the one it left").toContainText(before)
})
