import { test, expect } from "./fixtures"

// The Professional Cloud Architect exam, served in a browser: its home, its six study sections, and a Practice
// question that shows the constraint and gives each wrong option its own reason.
test.describe("the Professional Cloud Architect exam", () => {
  test.use({ serviceWorkers: "block" })

  test("serves its home, six study sections and a Practice question with a distinct reason for each wrong option", async ({ page, baseURL }) => {
    const origin = { origin: baseURL! }
    try {
      expect((await page.request.post("/api/exam", { headers: origin, data: { exam: "professional-cloud-architect" } })).ok()).toBe(true)
      await page.goto("/")
      await expect(page.locator("html")).toHaveAttribute("data-exam", "professional-cloud-architect")
      await expect(page.getByText("PROFESSIONAL CLOUD ARCHITECT")).toBeVisible()
      await page.goto("/study")
      await expect(page.locator('main a[href^="/study/"]').first()).toBeVisible()
      await expect(page.getByText(/Section [1-6] \(/)).toHaveCount(6)
      await page.goto("/practice")
      const question = page.locator("main p.font-medium").first()
      await expect(question).toBeVisible()
      expect((await question.innerText()).length, "the question carries its situation and its constraint").toBeGreaterThan(80)
      await page.getByRole("button", { name: /^A\./ }).click()
      await expect(page.getByText("WHY OTHER OPTIONS ARE WRONG:")).toBeVisible()
      const reasons = await page.locator("ul.space-y-2 li").allInnerTexts()
      expect(reasons).toHaveLength(3)
      // Each reason carries the letter of its own option, and never the letter of the right answer.
      const letters = await page.locator("ul.space-y-2 li span:first-child").allInnerTexts()
      const right = (await page.locator("button.bg-foreground").first().innerText()).trim().charAt(0)
      expect(letters.map((letter) => letter.trim().charAt(0)).sort()).toEqual(["A", "B", "C", "D"].filter((letter) => letter !== right))
      expect(new Set(reasons).size, "no reason repeats").toBe(3)
      for (const reason of reasons) expect(reason).not.toMatch(/does not meet the constraint|not the answer the scene asks for/)
    } finally {
      await page.request.post("/api/exam", { headers: origin, data: { exam: "generative-ai-leader" } })
    }
  })
})
