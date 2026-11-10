import { readdir, readFile, rm } from "node:fs/promises"
import path from "node:path"
import { expect, readyOffline, test } from "./fixtures"
import { e2eScratch } from "./server-env.mjs"

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
    // Remove what the test captured, keeping the server's own synthetic fixture: a stray page would change the
    // Night script, and the seeded recording for it would no longer match.
    const course = path.join(e2eScratch(Number(process.env.QUIZ_E2E_PORT ?? 47822)), "private-reading", "agentic-architect", "12")
    // Course 13 holds nothing in the test server, so anything saved there (the full-course test) is removed whole.
    await rm(path.join(path.dirname(course), "13"), { recursive: true, force: true })
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

  // The text of every reading the test saved in course 12, apart from the server's own two fixture pages.
  async function savedTexts(): Promise<string[]> {
    const course = path.join(e2eScratch(Number(process.env.QUIZ_E2E_PORT ?? 47822)), "private-reading", "agentic-architect", "12")
    const records = await Promise.all((await readdir(course)).map(async (name) => JSON.parse(await readFile(path.join(course, name), "utf8")) as { pageId: string; text: string }))
    return records.filter((record) => !["98001", "98002"].includes(record.pageId)).map((record) => record.text)
  }

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

  test("a selected passage is saved as its own copy and never replaces the whole page", async ({ page, context }) => {
    const source = await bookmarklet(page)
    const lessonPage = await context.newPage()
    await lessonPage.goto(`${SKILLS}/course_templates/1786/documents/7`)
    const send = async () => {
      const popupEvent = lessonPage.waitForEvent("popup")
      await lessonPage.evaluate((code) => (0, eval)(code), source)
      const popup = await popupEvent
      await expect(popup.getByRole("status")).toHaveText("Saved the private reading on this server. You can close this tab.")
      await popup.close()
    }
    await send()
    // Select just the passage, as the setup text suggests, and send the same page again.
    await lessonPage.evaluate(() => {
      const range = document.createRange()
      range.selectNodeContents(document.querySelector("p")!)
      const selection = window.getSelection()!
      selection.removeAllRanges()
      selection.addRange(range)
    })
    await send()
    await page.goto("/read/12")
    await expect(page.getByRole("link", { name: /Synthetic lesson 1786/ })).toHaveCount(2)
    // One copy is exactly the selected passage, the other is the whole page, which also holds its heading.
    const texts = await savedTexts()
    expect(texts).toHaveLength(2)
    expect(texts, "one copy is only the selected passage").toContain(SYNTHETIC)
    const whole = texts.find((text) => text !== SYNTHETIC)
    expect(whole, "the other copy is the whole page, not a second copy of the passage").toContain("Synthetic lesson 1786")
    expect(whole).toContain(SYNTHETIC)
  })

  test("a full course tells the person in the capture tab how to make room", async ({ page, browser, baseURL }) => {
    const source = await bookmarklet(page)
    const headers = { origin: baseURL!, "x-quiz-exam": "agentic-architect" }
    const course13 = path.join(e2eScratch(Number(process.env.QUIZ_E2E_PORT ?? 47822)), "private-reading", "agentic-architect", "13")
    // A browser with no offline worker takes the capture tab: with 300 readings in the course the worker would try to keep
    // every one of them, and that is not what this test is about.
    const quiet = await browser.newContext({ serviceWorkers: "block" })
    try {
      // Course 13 (template 1832) holds nothing yet. Fill it with small synthetic readings through the route the bookmarklet uses.
      for (let id = 1; id <= 300; id += 1) {
        const saved = await page.request.post("/api/reading/private", { headers, data: { template: "1832", pageId: String(id), title: "Synthetic", text: "Synthetic text." } })
        expect(saved.status(), `reading ${id}`).toBe(200)
      }
      expect((await page.request.post("/api/reading/private", { headers, data: { template: "1832", pageId: "301", title: "Synthetic", text: "Synthetic text." } })).status()).toBe(413)
      await quiet.route(`${SKILLS}/**`, (route) => route.fulfill({ contentType: "text/html", body: lesson("Synthetic lesson 1832", SYNTHETIC) }))
      const lessonPage = await quiet.newPage()
      await lessonPage.goto(`${SKILLS}/course_templates/1832/documents/1`)
      const popupEvent = lessonPage.waitForEvent("popup")
      await lessonPage.evaluate((code) => (0, eval)(code), source)
      const popup = await popupEvent
      await expect(popup.getByRole("status")).toHaveText("This course already holds as many private readings as it can. To make room, remove a saved reading's file from the private-reading folder (the README says where), then send this one again.")
    } finally {
      await quiet.close()
      // Gone at once, so no later page load makes the offline worker keep 300 readings.
      await rm(course13, { recursive: true, force: true })
    }
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
    await expect(popup.getByRole("status")).toHaveText("This course is not one this exam saves private copies for.")
    expect(posts).toEqual([])
  })

  // Records every message the receiver tab is sent, so a test can prove the forged one arrived and was refused.
  async function watchMessages(popup: import("@playwright/test").Page) {
    await popup.waitForLoadState("load")
    await popup.evaluate(() => {
      const w = window as unknown as { __seen: { origin: string; fromOpener: boolean; type: unknown }[] }
      w.__seen = []
      window.addEventListener("message", (event) => w.__seen.push({ origin: event.origin, fromOpener: event.source === window.opener, type: (event.data as { type?: unknown } | null)?.type }))
    })
  }
  const seenBy = (popup: import("@playwright/test").Page) => popup.evaluate(() => (window as unknown as { __seen: { origin: string; fromOpener: boolean; type: unknown }[] }).__seen)

  test("a page from any other origin cannot make the receiver save text", async ({ context, baseURL }) => {
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
      for (const wait of [300, 900, 1800, 2700]) setTimeout(send, wait)
    }, baseURL!)
    const popup = await popupEvent
    await watchMessages(popup)
    // Delivery is proved by the tab's own record of messages, so a pass cannot come from a message that never arrived.
    await expect.poll(async () => (await seenBy(popup)).filter((seen) => seen.origin === EVIL && seen.type === "star-reading").length, { timeout: 10_000 }).toBeGreaterThan(0)
    await popup.waitForTimeout(500)
    await expect(popup.getByRole("status")).toHaveText("Open this page with the Send to Star bookmarklet from a signed-in Google Skills course.")
    expect(posts).toEqual([])
  })

  test("a Google Skills page that did not open the receiver cannot make it save text either", async ({ context, baseURL }) => {
    const posts: string[] = []
    context.on("request", (request) => {
      if (request.method() === "POST" && new URL(request.url()).pathname === "/api/reading/private") posts.push(request.url())
    })
    const opener = await context.newPage()
    await opener.goto(`${SKILLS}/course_templates/1786/documents/1`)
    const popupEvent = opener.waitForEvent("popup")
    await opener.evaluate((origin) => {
      const w = window as unknown as { recv: Window | null; __ready: boolean }
      w.__ready = false
      w.recv = window.open(`${origin}/read/capture`, "_blank")
      window.addEventListener("message", (event) => {
        if (event.source === w.recv && (event.data as { type?: unknown } | null)?.type === "star-reading-ready") w.__ready = true
      })
    }, baseURL!)
    const popup = await popupEvent
    await watchMessages(popup)
    // The receiver has said it is listening, so what follows reaches a receiver that is ready.
    await opener.waitForFunction(() => (window as unknown as { __ready: boolean }).__ready)
    // A frame inside the opener has the Skills origin but is not the window that opened the receiver.
    await opener.evaluate(() => {
      const w = window as unknown as { recv: Window }
      const frame = document.createElement("iframe")
      document.body.appendChild(frame)
      const send = (frame.contentWindow as unknown as { Function: FunctionConstructor }).Function("target", "target.postMessage({ type: 'star-reading', template: '1786', pageId: '8', title: 'Forged', text: 'Forged text' }, '*')")
      send(w.recv)
    })
    await expect.poll(async () => (await seenBy(popup)).filter((seen) => seen.type === "star-reading").length, { timeout: 10_000 }).toBeGreaterThan(0)
    const forged = (await seenBy(popup)).filter((seen) => seen.type === "star-reading")
    expect(forged.every((seen) => seen.origin === SKILLS && seen.fromOpener === false), "it came from the Skills origin, but not from the opener").toBe(true)
    await popup.waitForTimeout(500)
    await expect(popup.getByRole("status")).toHaveText("Open this page with the Send to Star bookmarklet from a signed-in Google Skills course.")
    expect(posts).toEqual([])
    // The real opener, sending the same kind of message, is accepted: the receiver was working all along.
    await opener.evaluate(() => {
      const w = window as unknown as { recv: Window }
      w.recv.postMessage({ type: "star-reading", template: "1786", pageId: "9", title: "Control", text: "Control text" }, "*")
    })
    await expect(popup.getByRole("status")).toHaveText("Saved the private reading on this server. You can close this tab.")
    expect(posts).toHaveLength(1)
  })

  test("a page the server refuses is reported to the person, not hidden", async ({ page, context }) => {
    const source = await bookmarklet(page)
    const lessonPage = await context.newPage()
    await lessonPage.goto(`${SKILLS}/course_templates/1786/documents/6`)
    const popupEvent = lessonPage.waitForEvent("popup")
    await lessonPage.evaluate((code) => (0, eval)(code), source)
    const popup = await popupEvent
    await expect(popup.getByRole("status")).toHaveText("This page was not saved: it is empty or longer than 1,000,000 characters. Select just the passage you want and try again.")
  })

  test("the server rejects a save for the wrong exam or from another origin", async ({ page, baseURL }) => {
    const body = { template: "1786", pageId: "11", title: "Synthetic", text: "Synthetic text" }
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
    // The largest id the bookmarklet can make is accepted.
    const largest = await page.request.post("/api/reading/private", { headers: { origin: baseURL!, "x-quiz-exam": "agentic-architect" }, data: { ...body, pageId: "18446744073709551615" } })
    expect(largest.status()).toBe(200)
  })

  test("the Read list keeps courses without text in their own section, each with its reason, without sideways scrolling", async ({ page }) => {
    await page.goto("/read")
    await readyOffline(page)
    await page.waitForLoadState("networkidle")
    await expect(page.getByRole("heading", { name: "Not read aloud", exact: true })).toBeVisible()
    await expect(page.getByText("No text to read aloud")).toHaveCount(3)
    // Only the course with a saved copy (12, seeded by the test server) is marked; course 13 has none yet.
    await expect(page.getByText("Private copy on this server")).toHaveCount(1)
    const section = page.getByRole("region", { name: "Not read aloud" })
    await expect(section.getByRole("link")).toHaveCount(3)
    for (const link of await section.getByRole("link").all()) await expect(link).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
  })
})
