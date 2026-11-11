import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import { expect, readyOffline, test } from "./fixtures"
import { e2eScratch } from "./server-env.mjs"

// Read Aloud's private readings as the browser meets them: the course list, a damaged saved copy, and what the save route refuses.
// No real course text is used anywhere.
const EVIL = "https://opener.example"

// Loading a new page over the old one makes WebKit report the cut-off requests as errors; see fixtures.ts.
// The offline worker may start a voice download of its own, which the test server refuses; see expected-errors.ts.
test.use({ navigationCutOff: true, voiceClipRefusal: true })

test.describe("Private readings in Read Aloud", () => {
  test.beforeEach(async ({ page, baseURL }) => {
    expect((await page.request.post("/api/exam", { headers: { origin: baseURL! }, data: { exam: "agentic-architect" } })).ok()).toBe(true)
  })
  test.afterEach(async ({ page, context, baseURL }) => {
    // Remove what the test captured, keeping the server's own synthetic fixture: a stray page would change the
    // Night script, and the seeded recording for it would no longer match.
    const course = path.join(e2eScratch(Number(process.env.QUIZ_E2E_PORT ?? 47822)), "private-reading", "agentic-architect", "8")
    // Course 4 holds nothing in the test server, so anything saved there (the full-course test) is removed whole.
    await rm(path.join(path.dirname(course), "4"), { recursive: true, force: true })
    for (const name of await readdir(course)) {
      const record = JSON.parse(await readFile(path.join(course, name), "utf8")) as { pageId: string }
      if (!["98001", "98002"].includes(record.pageId)) await rm(path.join(course, name))
    }
    // Close the synthetic tabs first: the fixture's worker clean-up stalls in a page that is not in front.
    await Promise.all(context.pages().filter((other) => other !== page).map((other) => other.close()))
    await page.bringToFront()
    await page.request.post("/api/exam", { headers: { origin: baseURL! }, data: { exam: "generative-ai-leader" } })
    // The shared fixture unregisters the worker from the quiz page, so the page must be back on the quiz.
    await page.goto("/progress")
    // The fixture unregisters the worker, which stalls while it is still installing. Only "ready" is waited for here: a page that
    // has just registered the worker may have been taken over before this line runs, and waiting for that event would hang.
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined))
    await page.waitForLoadState("networkidle")
  })


  test("a damaged private copy says to remove that file, with both ways on", async ({ page }) => {
    const course4 = path.join(e2eScratch(Number(process.env.QUIZ_E2E_PORT ?? 47822)), "private-reading", "agentic-architect", "4")
    await mkdir(course4, { recursive: true })
    await writeFile(path.join(course4, "damaged.json"), "{ not json at all")
    try {
      await page.goto("/read/4")
      await expect(page.locator("p[role=alert]")).toHaveText("This server could not read one of the private copies of this course. A saved file may be damaged: remove it from the private-reading folder (see the README), then try again.")
      await expect(page.getByRole("link", { name: "TRY AGAIN" })).toBeVisible()
      await expect(page.getByRole("link", { name: "ALL COURSES" })).toBeVisible()
      await expect(page.getByText(/^Detail: Private reading record .+ is not valid JSON\.$/)).toBeVisible()
      // The page has started the offline worker; it must finish installing before the exam is switched back.
      await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined))
    } finally {
      // Gone before anything else loads the course, so the offline worker and Night reading never meet the damaged file.
      await rm(course4, { recursive: true, force: true })
    }
  })


  test("the server rejects a save for the wrong exam or from another origin", async ({ page, baseURL }) => {
    const body = { template: "1385", pageId: "11", title: "Synthetic", text: "Synthetic text" }
    const wrongExam = await page.request.post("/api/reading/private", { headers: { origin: baseURL!, "x-quiz-exam": "generative-ai-leader" }, data: body })
    expect(wrongExam.status()).toBe(409)
    expect(await wrongExam.json()).toMatchObject({ wrongExam: "agentic-architect" })
    const foreign = await page.request.post("/api/reading/private", { headers: { origin: EVIL, "x-quiz-exam": "agentic-architect" }, data: body })
    expect(foreign.status()).toBe(400)
    const wrongTemplate = await page.request.post("/api/reading/private", { headers: { origin: baseURL!, "x-quiz-exam": "agentic-architect" }, data: { ...body, template: "999" } })
    expect(wrongTemplate.status()).toBe(400)
    expect(await wrongTemplate.json()).toMatchObject({ reason: "template" })
    // A page id longer than 20 digits is refused before anything is saved, as is an id that is not digits.
    for (const pageId of ["1".repeat(21), "abc", ""]) {
      const refused = await page.request.post("/api/reading/private", { headers: { origin: baseURL!, "x-quiz-exam": "agentic-architect" }, data: { ...body, pageId } })
      expect(refused.status(), `page id "${pageId}"`).toBe(400)
      expect(await refused.json()).toMatchObject({ reason: "id" })
    }
    // The largest 64-bit id is accepted.
    const largest = await page.request.post("/api/reading/private", { headers: { origin: baseURL!, "x-quiz-exam": "agentic-architect" }, data: { ...body, pageId: "18446744073709551615" } })
    expect(largest.status()).toBe(200)
  })


  test("the Read list is one list in course order: a course without text keeps its place, with its reason, without sideways scrolling", async ({ page }) => {
    await page.goto("/read")
    await readyOffline(page)
    await page.waitForLoadState("networkidle")
    await expect(page.getByRole("heading", { name: "Not read aloud" })).toHaveCount(0)
    await expect(page.getByText("No text to read aloud")).toHaveCount(0)
    // Only the course with a saved copy (8, seeded by the test server) is marked; course 4 has none yet.
    await expect(page.getByText("Private copy on this server")).toHaveCount(1)
    const numbers = (await page.getByText(/^Course \d+:/).allTextContents()).map((text) => Number(text.match(/^Course (\d+):/)![1]))
    expect(numbers, "every course, in order").toEqual([...numbers].sort((a, b) => a - b))
    expect(numbers).toHaveLength(8)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
  })
})
