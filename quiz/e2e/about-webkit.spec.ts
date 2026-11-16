import { expect, test } from "./fixtures"

// WebKit only. Safari takes the list meaning away from a list styled with list-style: none, so the About page's feature list carries
// role="list" itself. Playwright works out roles from the markup in every engine, so this cannot show Safari's own behaviour: it checks
// that the attribute that protects it is there and that the items read as a list.
test("the About page's features are a list, with the role Safari needs", async ({ page }) => {
  await page.goto("/about")
  await expect(page.getByRole("main").locator("ul").first()).toHaveAttribute("role", "list")
  await expect(page.getByRole("main").getByRole("listitem")).toHaveText([
    /^Voice quiz/,
    /^Read aloud/,
    /^Practice questions/,
    /^Test exam/,
    /^Flashcards/,
    /^Private and offline/,
  ])
})
