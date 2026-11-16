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
      // Each reason carries the letter of its own option: the reason starts with that option's name.
      const options = await page.locator("main button:has(span.font-bold)").evaluateAll((buttons) =>
        buttons.map((button) => ({ letter: (button.querySelector("span.font-bold")?.textContent ?? "").trim().charAt(0), text: (button.querySelectorAll("span")[1]?.textContent ?? "").trim() })),
      )
      expect(options.map((option) => option.letter)).toEqual(["A", "B", "C", "D"])
      const right = (await page.locator("button.bg-foreground").first().innerText()).trim().charAt(0)
      expect(["A", "B", "C", "D"], "the right answer is one of the options").toContain(right)
      for (const option of options) expect(option.text, `option ${option.letter} has text`).not.toBe("")
      const rows = await page.locator("ul.space-y-2 li").evaluateAll((items) =>
        items.map((item) => ({ letter: (item.querySelector("span")?.textContent ?? "").trim().charAt(0), reason: (item.querySelectorAll("span")[1]?.textContent ?? "").trim() })),
      )
      for (const row of rows) {
        const own = options.find((option) => option.letter === row.letter)
        expect(own, `a reason lettered ${row.letter} has an option`).toBeTruthy()
        expect(row.letter, "never the right answer's letter").not.toBe(right)
        expect(row.reason.startsWith(own!.text), `reason ${row.letter} is about option ${row.letter} (${own!.text})`).toBe(true)
      }
      expect(new Set(reasons).size, "no reason repeats").toBe(3)
      for (const reason of reasons) expect(reason).not.toMatch(/does not meet the constraint|not the answer the scene asks for/)
    } finally {
      await page.request.post("/api/exam", { headers: origin, data: { exam: "generative-ai-leader" } })
    }
  })
})
