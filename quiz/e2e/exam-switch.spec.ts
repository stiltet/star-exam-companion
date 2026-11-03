import type { Page } from "@playwright/test"
import { test, expect } from "./fixtures"

// A switch makes the browser fetch the other exam's worker, which installs while the old one still runs.
// Wait for that to finish, so the fixture does not unregister a worker mid-install.
async function settleWorker(page: Page) {
  await page.waitForLoadState("networkidle")
  // Ask for the update now, rather than whenever the browser gets round to it, so it is always seen below.
  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration()
    await registration?.update().catch(() => undefined)
  })
  await expect.poll(() => page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration()
    return !registration || (!registration.installing && !registration.waiting)
  })).toBe(true)
}

// The switch loads a new page over the old one, which WebKit reports as cut-off requests; see fixtures.ts.
test.use({ navigationCutOff: true })

// Covers components/exam-switcher.tsx (the dropdown and its confirmation), components/site-header-view.tsx
// (the menu of the exam served, rendered on every page) and app/read/layout.tsx (the Read Aloud guard) through the
// Progress page.
test("exam-switcher: a tap outside the confirmation cancels, and confirming switches the exam for the whole install", async ({ page, baseURL }) => {
  const pick = page.getByLabel("Exam", { exact: true })
  try {
    await page.goto("/progress")
    await expect(pick).toHaveValue("generative-ai-leader")
    // Let the device finish storing the voice clips first: a clip still downloading when the exam switches
    // asks for a line the new exam does not have, and the fixture counts that 404 as a browser error.
    await expect(page.getByRole("row", { name: /Voice for offline/ })).toContainText(/(\d+) of \1 lines/, { timeout: 40_000 })
    // And for the page to go quiet: WebKit reports a prefetch or a storage call cut off by the switch's page load as an
    // uncaught error, so the switch must not land while the page is still fetching.
    await page.waitForLoadState("networkidle")

    // Picking another exam opens the confirmation; a tap outside it closes it and puts the dropdown back.
    await pick.selectOption("agentic-architect")
    await expect(page.getByRole("dialog")).toBeVisible()
    await page.mouse.click(2, 2)
    await expect(page.getByRole("dialog")).toBeHidden()
    await expect(pick).toHaveValue("generative-ai-leader")

    // Confirming switches, and lands on the home page of the new exam.
    await pick.selectOption("agentic-architect")
    await page.getByRole("button", { name: "Switch exam", exact: true }).click()
    await page.waitForURL((url) => url.pathname === "/")
    await expect(page.locator("html")).toHaveAttribute("data-exam", "agentic-architect")
    await settleWorker(page)
    await expect(page.getByText("PROFESSIONAL AGENTIC ARCHITECT")).toBeVisible()

    // The read layout lets the new exam's Read Aloud pages through. Night reading needs no course text,
    // so the test never reaches Google.
    expect((await page.request.get("/read/night")).status()).toBe(200)

    // The unfinished pack, with no written questions, renders every page without a server error.
    for (const route of ["/study", "/practice", "/practice?section=1", "/exam", "/flashcards", "/glossary", "/voice", "/progress"]) {
      expect((await page.request.get(route)).status(), route).toBe(200)
    }
    await page.goto("/progress")
    await expect(page.getByRole("row", { name: /Package/ })).toContainText("Professional Agentic Architect")
    await page.goto("/exam")
    await expect(page.getByText("Unfinished:")).toBeVisible()
    await page.goto("/")
    await expect(page.getByRole("heading", { name: "DESCRIPTION" })).toBeVisible()
    await expect(page.getByText("Unfinished:")).toBeVisible()
  } finally {
    // The server keeps the choice for every test that follows, so put Generative AI Leader back.
    const back = await page.request.post("/api/exam", { headers: { origin: baseURL! }, data: { exam: "generative-ai-leader" } })
    expect(back.ok(), "Put the scratch server back on Generative AI Leader").toBe(true)
    // The next load fetches the restored exam's worker; let it settle too.
    await page.goto("/")
    await settleWorker(page)
  }
})
