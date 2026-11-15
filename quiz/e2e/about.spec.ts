import { expect, test } from "./fixtures"

// The one dated line the About page holds, as it reads in lower case. Only this exact text is allowed to carry digits.
const PASSED_LINE = "passed october 2026"

// The About page is public and ships in the online demo: it holds what the app is, who built it and where the source is, and none of
// anyone's studying. The owner approved its contents (a plan and a mockup); these tests fail if figures or plans come back onto it.
test("the About page shows the approved sections and none of the visitor's own study figures", async ({ page, baseURL }) => {
  // A person who has answered questions: twelve saved exam sessions, which the page this replaced turned into a count and a best
  // percentage ("12 · best 50%" under "Practice exams taken"), next to the answered counts, flashcards known and lessons read. The page
  // is static today and reads none of this, so the guard below is on its text; the seed makes the test fail for the right reason if a
  // later version of the page starts to read what is saved.
  const snapshot = (await (await page.request.get("/api/snapshot")).json()) as { snapshot: { items: { id: string }[] } }
  const [first, second] = snapshot.snapshot.items.map((item) => item.id)
  const sessions = Array.from({ length: 12 }, (_, index) => ({
    id: crypto.randomUUID(),
    at: new Date(Date.UTC(2026, 0, 1 + index)).toISOString(),
    mode: "exam",
    asked: [first, second],
    missed: [first],
    seconds: 60,
  }))
  const saved = await page.request.post("/api/scores", { headers: { origin: baseURL! }, data: { answers: sessions } })
  expect(await saved.json()).toMatchObject({ ok: true, rejected: [] })

  await page.goto("/about")
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("About")
  await expect(page.getByRole("heading", { level: 2 })).toHaveText(["What it does", "Author", "Certifications", "Open source"])
  const text = (await page.locator("main").innerText()).toLowerCase()
  // The labels and sentences the old page used, and the shape of its figures: a percentage, or the word best.
  for (const banned of ["studying now", "in preparation", "planned for", "valid until", "my exam", "my certifications", "answered", "practice exams taken", "none yet", "flashcards known", "lessons read"]) {
    expect(text.includes(banned), `the About page says "${banned}"`).toBe(false)
  }
  expect(text.includes("%"), "the About page shows a percentage").toBe(false)
  expect(/\bbest\b/.test(text), "the About page says best").toBe(false)
  // The only digits the page may hold are the ones in the line saying when the certification was passed. This checks digits of any
  // script, not spelled-out figures: those are caught by the banned labels above, not by this line.
  expect(text.replace(PASSED_LINE, ""), "the About page holds a number other than the year it was passed").not.toMatch(/\p{Nd}/u)
})

test("the About page's features are a list in the accessibility tree", async ({ page }) => {
  await page.goto("/about")
  await expect(page.getByRole("main").getByRole("listitem")).toHaveText([
    /^Voice quiz/,
    /^Read aloud/,
    /^Practice questions/,
    /^Practice exam/,
    /^Flashcards/,
    /^Private and offline/,
  ])
})
