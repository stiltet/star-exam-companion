import { expect, test } from "./fixtures"

// The About page is public and ships in the online demo: it holds what the app is, who built it and where the source is, and none of
// anyone's studying. The owner approved its contents (a plan and a mockup); this fails if figures or plans come back onto it.
test("the About page shows the approved sections and none of the visitor's own study figures", async ({ page, baseURL }) => {
  // A person who has answered questions: twelve saved sessions, which the page this replaced turned into counts and a best score.
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
  for (const banned of ["studying now", "in preparation", "planned for", "valid until", "my exam", "my certifications", "answered", "best score", "flashcards known", "lessons read"]) {
    expect(text.includes(banned), `the About page says "${banned}"`).toBe(false)
  }
  // The feature list is a real list for a screen reader.
  await expect(page.locator("main ul[role='list'] > li")).toHaveCount(6)
})
