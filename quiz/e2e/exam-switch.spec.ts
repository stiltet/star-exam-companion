import type { Page } from "@playwright/test"
import { test, expect, openVoice } from "./fixtures"

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
// The E2E server seeds synthetic private pages for course 8, so one of the eight courses is readable: course 8. The other seven are saved by the capture command.
const UNFINISHED = /^Unfinished: Read Aloud can read 1 of 8 courses on this server; 7 courses need reading text\.$/

test.use({ navigationCutOff: true })

// Covers components/atoms/select.tsx through components/exam-switcher.tsx (the dropdown and its confirmation),
// components/site-header-view.tsx
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
    const home = page.locator("main section").first()
    await expect(home.getByRole("link", { name: /^TEST EXAM/ })).toHaveAttribute("href", "/exam")
    await expect(home.getByText("PRACTICE EXAM", { exact: true })).toHaveCount(0)
    await expect(page.getByText(UNFINISHED)).toHaveCount(0)
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
    for (const title of [
      "Understand Google Cloud Agents",
      "Agentic Strategy: Discover, Design, and Prototype",
      "Optimize Agent Behavior",
      "Build Agent Skills with Google",
      "Engineer AI Agents with Agent Development Kit (ADK)",
      "Build AI Agents with Enterprise Databases",
      "AgentOps: Operationalize AI Agents on Google Cloud",
      "Model Armor: Securing AI Deployments",
    ]) await expect(page.getByText(title)).toBeVisible()
    await expect(page.getByText("Gen AI: Beyond the Chatbot")).toHaveCount(0)
    // Every course on the path is captured from Google, so none is marked as having no text.
    await expect(page.getByText("No text to read aloud")).toHaveCount(0)
    await expect(page.getByRole("heading", { name: "Not read aloud" })).toHaveCount(0)
    await page.getByRole("link", { name: /Build Agent Skills with Google/ }).click()
    await expect(page.getByRole("heading", { name: "Build Agent Skills with Google" })).toBeVisible()
    // The course page's components/atoms/breadcrumb.tsx links back to the Read Aloud list.
    const breadcrumb = page.getByRole("navigation", { name: "Breadcrumb" })
    await expect(breadcrumb.getByRole("link", { name: "READ ALOUD" })).toHaveAttribute("href", "/read")
    await expect(breadcrumb).toContainText(/COURSE \d+/)
    await expect(page.getByText(/No private copy is saved on this server yet/)).toBeVisible()
    await expect(page.getByRole("link", { name: "OPEN ON GOOGLE SKILLS" })).toHaveAttribute("href", "https://www.skills.google/course_templates/1832")
    await expect(page.getByText(UNFINISHED)).toHaveCount(0)
    await page.goBack()
    // The list says the pack is unfinished, so the unread courses are not taken as the whole learning path.
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

    // The unfinished pack renders every page in the browser: the fixture fails the test on a script error,
    // and each page must show a heading.
    for (const route of ["/study", "/practice", "/practice?section=1", "/exam", "/flashcards", "/glossary", "/progress", "/read/night"]) {
      await page.goto(route)
      await expect(page.locator("h1, h2").first(), route).toBeVisible()
      await expect(page.getByText(UNFINISHED), route).toHaveCount(0)
    }
    await openVoice(page)
    await expect(page.locator("h1, h2").first(), "/voice").toBeVisible()
    await page.goto("/progress")
    await expect(page.getByRole("row", { name: /Package/ })).toContainText("Professional Agentic Architect")
    await expect(page.getByText(UNFINISHED)).toHaveCount(0)
    await page.goto("/exam")
    await expect(page.getByText(UNFINISHED)).toHaveCount(0)
    await page.goto("/")
    await expect(page.getByRole("heading", { name: "DESCRIPTION" })).toBeVisible()
    await expect(page.getByText(UNFINISHED)).toHaveCount(0)
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
