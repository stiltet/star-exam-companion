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
// The start of the Agentic Architect pack's notice (exams/agentic-architect/pack.json).
const UNFINISHED = /Unfinished: Read Aloud covers six courses, five of the learning path's twelve/

test.use({ navigationCutOff: true })

// Covers components/exam-switcher.tsx (the dropdown and its confirmation), components/site-header-view.tsx
// (the menu of the exam served, rendered on every page) and app/read/layout.tsx (the Read Aloud guard) through the
// Progress page.
test("exam-switcher: a tap outside the confirmation cancels, and confirming switches the exam for the whole install", async ({ page, baseURL }) => {
  // WebKit stores the 1,500 or so voice clips at between 2 and 15 a second on a busy machine, slowing as the store grows, so the wait below can take ten minutes.
  test.setTimeout(900_000)
  const pick = page.getByLabel("Exam", { exact: true })
  try {
    await page.goto("/progress")
    await expect(pick).toHaveValue("generative-ai-leader")
    // Let the device finish storing the voice clips first: a clip still downloading when the exam switches
    // asks for a line the new exam does not have, and the fixture counts that 404 as a browser error.
    await expect(page.getByRole("row", { name: /Voice for offline/ })).toContainText(/(\d+) of \1 lines/, { timeout: 840_000 })
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
    // The long exam name stays on one line at this width, shrunk to fit rather than wrapped or cut off.
    const hero = page.getByText("PROFESSIONAL AGENTIC ARCHITECT")
    const lines = await hero.evaluate((el) => el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight))
    expect(lines, "the hero title is one line").toBeLessThan(1.5)
    const box = (await hero.boundingBox())!
    expect(box.x + box.width, "and fits inside the page").toBeLessThanOrEqual(page.viewportSize()!.width)

    // The read layout lets the new exam's Read Aloud pages through. Night reading needs no course text,
    // so the test never reaches Google.
    expect((await page.request.get("/read/night")).status()).toBe(200)

    // Read Aloud lists this exam's own courses and none of the other exam's. The list needs no course text.
    await page.goto("/read")
    await expect(page.getByText("Manage Agent Memory and State")).toBeVisible()
    await expect(page.getByText("Add Agent Capabilities with Tools")).toBeVisible()
    await expect(page.getByText("Build Your First Agent with Agent Development Kit (ADK)")).toBeVisible()
    // The two courses Google publishes in its newer format are listed too.
    await expect(page.getByText("AgentOps: Operationalize AI Agents on Google Cloud")).toBeVisible()
    await expect(page.getByText("Understand Google Cloud Agents")).toBeVisible()
    await expect(page.getByText("Gen AI: Beyond the Chatbot")).toHaveCount(0)
    // The list says the pack is unfinished, so six courses are not read as the whole learning path.
    await expect(page.getByText(UNFINISHED)).toBeVisible()

    // A page of the other exam is refused with 409 and the exam served, so its answers are never stored
    // against this exam's scores.
    const other = { origin: baseURL!, "x-quiz-exam": "generative-ai-leader" }
    for (const path of ["/api/scores", "/api/scores/reset"]) {
      const refused = await page.request.post(path, { headers: other, data: path === "/api/scores" ? { answers: [] } : {} })
      expect(refused.status(), path).toBe(409)
      expect(await refused.json(), path).toMatchObject({ ok: false, wrongExam: "agentic-architect" })
    }
    const snapshot = await page.request.get("/api/snapshot", { headers: other })
    expect(snapshot.status(), "/api/snapshot").toBe(409)

    // The unfinished pack, with no written questions, renders every page in the browser: the fixture fails the
    // test on a script error, and each page must show a heading.
    for (const route of ["/study", "/practice", "/practice?section=1", "/exam", "/flashcards", "/glossary", "/voice", "/progress"]) {
      await page.goto(route)
      await expect(page.locator("h1, h2").first(), route).toBeVisible()
      // The pack says it is unfinished on the Practice page too, in the pack's own words.
      if (route === "/practice") await expect(page.getByText(UNFINISHED)).toBeVisible()
    }
    await page.goto("/progress")
    await expect(page.getByRole("row", { name: /Package/ })).toContainText("Professional Agentic Architect")
    // The course tracking table carries the same notice.
    await expect(page.getByText(UNFINISHED)).toBeVisible()
    await page.goto("/exam")
    await expect(page.getByText(UNFINISHED)).toBeVisible()
    await page.goto("/")
    await expect(page.getByRole("heading", { name: "DESCRIPTION" })).toBeVisible()
    await expect(page.getByText(UNFINISHED)).toBeVisible()
  } finally {
    // The server keeps the choice for every test that follows, so put Generative AI Leader back.
    const back = await page.request.post("/api/exam", { headers: { origin: baseURL! }, data: { exam: "generative-ai-leader" } })
    expect(back.ok(), "Put the scratch server back on Generative AI Leader").toBe(true)
    // The next load fetches the restored exam's worker; let it settle too.
    await page.goto("/")
    await settleWorker(page)
  }
})

// Without the worker, because WebKit sends a page's requests through it and then page.route never sees them.
test.describe("exam-switcher: a refused switch", () => {
  test.use({ serviceWorkers: "block" })

  test("says so and leaves the exam as it was", async ({ page }) => {
    await page.goto("/progress")
    const pick = page.getByLabel("Exam", { exact: true })
    await expect(pick).toHaveValue("generative-ai-leader")
    await page.waitForLoadState("networkidle")
    // The page reads the answer, not the status; a 4xx would also be logged by the browser as a failed load, which the fixture reports.
    await page.route("**/api/exam", (route) => route.fulfill({ contentType: "application/json", body: '{"ok":false}' }))
    await pick.selectOption("agentic-architect")
    await page.getByRole("button", { name: "Switch exam", exact: true }).click()
    await expect(page.getByRole("status").filter({ hasText: "The exam was not switched" })).toBeVisible()
    await expect(page.locator("html")).toHaveAttribute("data-exam", "generative-ai-leader")
    await expect(pick).toHaveValue("generative-ai-leader")
    // The Mac still serves the exam it did.
    const served = await page.request.get("/api/snapshot", { headers: { "x-quiz-exam": "generative-ai-leader" } })
    expect(served.status()).toBe(200)
  })
})

// This page is only read, so the worker is left out: its install would queue behind the new exam's voice downloads.
test.describe("a pack with no course to read", () => {
  test.use({ serviceWorkers: "block" })

  test("still shows Read Aloud, and says there is none", async ({ page, baseURL }) => {
    const origin = { origin: baseURL! }
    try {
      // The scratch pack of server.mjs: the second exam's pack with its Read Aloud courses taken out.
      expect((await page.request.post("/api/exam", { headers: origin, data: { exam: "no-course-test" } })).ok()).toBe(true)
      await page.goto("/")
      await expect(page.getByRole("link", { name: /OFFICIAL LEARNING READ ALOUD/ })).toBeVisible()
      await page.goto("/read")
      await expect(page.getByText("Read Aloud has no course for Exam With No Course yet")).toBeVisible()
      await expect(page.getByRole("link", { name: "OFFICIAL LEARNING PATH" })).toBeVisible()
      // Nothing to pick or to read at night, and no course card.
      await expect(page.getByRole("link", { name: "Night reading" })).toHaveCount(0)
      await expect(page.getByText("Pick a course")).toHaveCount(0)
    } finally {
      await page.request.post("/api/exam", { headers: origin, data: { exam: "generative-ai-leader" } })
    }
  })
})
