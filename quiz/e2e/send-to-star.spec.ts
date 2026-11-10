import { expect, readyOffline, test } from "./fixtures"

// The real Send to Star bookmarklet, run on synthetic pages that are served at the Google Skills origin
// without touching the network. No real course text is used anywhere.
const SKILLS = "https://www.skills.google"
const EVIL = "https://opener.example"
const SYNTHETIC = ["Synthetic captured reading", "text for the Send to Star browser test."].join(" ")

function lesson(title: string, text: string) {
  return `<!doctype html><html><head><title>${title}</title></head><body><main><h1>${title}</h1><p>${text}</p></main></body></html>`
}

// Loading a new page over the old one makes WebKit report the cut-off requests as errors; see fixtures.ts.
test.use({ navigationCutOff: true })

test.describe("Send to Star", () => {
  test.beforeEach(async ({ page, baseURL, context }) => {
    expect((await page.request.post("/api/exam", { headers: { origin: baseURL! }, data: { exam: "agentic-architect" } })).ok()).toBe(true)
    await context.route(`${SKILLS}/**`, (route) => {
      const url = new URL(route.request().url())
      const template = url.pathname.match(/course_templates\/(\d+)/)?.[1] ?? "0"
      // A page over the server's size limit makes the server refuse it, which is a real failure with no mocked answer.
      const text = url.pathname.endsWith("/documents/6") ? "x".repeat(1_000_001) : SYNTHETIC
      return route.fulfill({ contentType: "text/html", body: lesson(`Synthetic lesson ${template}`, text) })
    })
    await context.route(`${EVIL}/**`, (route) => route.fulfill({ contentType: "text/html", body: "<!doctype html><title>x</title>" }))
  })
  test.afterEach(async ({ page, context, baseURL }) => {
    // Close the synthetic tabs first: the fixture's worker clean-up stalls in a page that is not in front.
    await Promise.all(context.pages().filter((other) => other !== page).map((other) => other.close()))
    await page.bringToFront()
    await page.request.post("/api/exam", { headers: { origin: baseURL! }, data: { exam: "generative-ai-leader" } })
    // The shared fixture unregisters the worker from the quiz page, so the page must be back on the quiz.
    await page.goto("/progress")
    // The fixture unregisters the worker, which stalls while it is still installing.
    await readyOffline(page)
    await page.waitForLoadState("networkidle")
  })

  async function bookmarklet(page: import("@playwright/test").Page): Promise<string> {
    await page.goto("/read")
    // Let the offline worker finish installing before anything else: switching the exam under an install stalls it.
    await readyOffline(page)
    await page.waitForLoadState("networkidle")
    // The bookmarklet is built in the browser after the page loads, so wait until the box holds it.
    await expect(page.getByLabel("Send to Star bookmarklet")).toHaveValue(/^javascript:/)
    const source = await page.getByLabel("Send to Star bookmarklet").inputValue()
    return source.slice("javascript:".length)
  }

  test("a lesson page sends its text through the real bookmarklet and the saved copy reads offline-ready", async ({ page, context }) => {
    const source = await bookmarklet(page)
    const lessonPage = await context.newPage()
    await lessonPage.goto(`${SKILLS}/course_templates/1786/documents/98001`)
    const popupEvent = lessonPage.waitForEvent("popup")
    await lessonPage.evaluate((code) => (0, eval)(code), source)
    const popup = await popupEvent
    await expect(popup.getByRole("status")).toHaveText("Saved the private reading on this server. You can close this tab.")
    await popup.close()
    await lessonPage.close()
    await page.goto("/read/12")
    await page.getByRole("link", { name: /Synthetic lesson 1786/ }).click()
    await expect(page.locator("main")).toContainText(SYNTHETIC)
    await expect(page.getByText("This reading is from a private copy on this server.")).toBeVisible()
  })

  test("a course the pack does not list is refused and nothing is sent to the server", async ({ page, context }) => {
    const source = await bookmarklet(page)
    const posts: string[] = []
    context.on("request", (request) => {
      if (request.method() === "POST" && new URL(request.url()).pathname === "/api/reading/private") posts.push(request.url())
    })
    const lessonPage = await context.newPage()
    await lessonPage.goto(`${SKILLS}/course_templates/424242/documents/1`)
    const popupEvent = lessonPage.waitForEvent("popup")
    await lessonPage.evaluate((code) => (0, eval)(code), source)
    const popup = await popupEvent
    await expect(popup.getByRole("status")).toHaveText("This course is not configured for private reading in the active pack.")
    expect(posts).toEqual([])
  })

  test("a page from any other origin cannot make the receiver save text", async ({ page, context, baseURL }) => {
    const posts: string[] = []
    context.on("request", (request) => {
      if (request.method() === "POST" && new URL(request.url()).pathname === "/api/reading/private") posts.push(request.url())
    })
    const other = await context.newPage()
    await other.goto(`${EVIL}/x`)
    const popupEvent = other.waitForEvent("popup")
    await other.evaluate((origin) => {
      const target = window.open(`${origin}/read/capture`, "_blank")
      const send = () => target?.postMessage({ type: "star-reading", template: "1786", pageId: "7", title: "Forged", text: "Forged text" }, "*")
      for (const wait of [300, 900, 1800]) setTimeout(send, wait)
    }, baseURL!)
    const popup = await popupEvent
    await popup.waitForLoadState("load")
    await other.waitForTimeout(2500)
    await expect(popup.getByRole("status")).toHaveText("Open this page with the Send to Star bookmarklet from a signed-in Google Skills course.")
    expect(posts).toEqual([])
  })

  test("a page the server refuses is reported to the person, not hidden", async ({ page, context }) => {
    const source = await bookmarklet(page)
    const lessonPage = await context.newPage()
    await lessonPage.goto(`${SKILLS}/course_templates/1786/documents/6`)
    const popupEvent = lessonPage.waitForEvent("popup")
    await lessonPage.evaluate((code) => (0, eval)(code), source)
    const popup = await popupEvent
    await expect(popup.getByRole("status")).toHaveText("The server could not save this reading (HTTP 400).")
  })

  test("the server rejects a save for the wrong exam or from another origin", async ({ page, baseURL }) => {
    const body = { template: "1786", pageId: "11", title: "Synthetic", text: "Synthetic text" }
    const wrongExam = await page.request.post("/api/reading/private", { headers: { origin: baseURL!, "x-quiz-exam": "generative-ai-leader" }, data: body })
    expect(wrongExam.ok()).toBe(false)
    const foreign = await page.request.post("/api/reading/private", { headers: { origin: EVIL, "x-quiz-exam": "agentic-architect" }, data: body })
    expect(foreign.status()).toBe(400)
    const wrongTemplate = await page.request.post("/api/reading/private", { headers: { origin: baseURL!, "x-quiz-exam": "agentic-architect" }, data: { ...body, template: "999" } })
    expect(wrongTemplate.status()).toBe(400)
  })

  test("the Read list keeps courses without text in their own section, each with its reason, without sideways scrolling", async ({ page }) => {
    await page.goto("/read")
    await readyOffline(page)
    await page.waitForLoadState("networkidle")
    await expect(page.getByRole("heading", { name: "Not read aloud", exact: true })).toBeVisible()
    await expect(page.getByText("No text to read aloud")).toHaveCount(3)
    await expect(page.getByText("Private copy on this server")).toHaveCount(2)
    const section = page.getByRole("region", { name: "Not read aloud" })
    await expect(section.getByRole("link")).toHaveCount(3)
    for (const link of await section.getByRole("link").all()) await expect(link).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
  })
})
