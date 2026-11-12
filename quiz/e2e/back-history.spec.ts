import type { Page } from "@playwright/test"
import { test, expect } from "./fixtures"

// The installed app's Back button must behave like a normal back button on every page: return to the page
// just before, at the scroll it was left at. One test per suspected cause of it jumping around.
const standalone = () => {
  Object.defineProperty(navigator, "standalone", { value: true, configurable: true })
}

async function saveExams(page: Page, origin: string) {
  const snapshot = (await (await page.request.get("/api/snapshot")).json()) as { snapshot: { items: { id: string }[] } }
  const [first, second] = snapshot.snapshot.items.map((item) => item.id)
  const exams = Array.from({ length: 12 }, (_, index) => ({
    id: crypto.randomUUID(),
    at: new Date(Date.UTC(2026, 0, 1 + index)).toISOString(),
    mode: "exam",
    asked: [first, second],
    missed: [first],
    seconds: 60,
  }))
  const saved = await page.request.post("/api/scores", { headers: { origin }, data: { answers: exams } })
  expect(await saved.json()).toMatchObject({ ok: true, rejected: [] })
}

const back = (page: Page) => page.getByLabel("Back", { exact: true })
const scrollY = (page: Page) => page.evaluate(() => window.scrollY)
const near = async (page: Page, expected: number) => expect.poll(async () => Math.abs((await scrollY(page)) - expected), { timeout: 5000 }).toBeLessThanOrEqual(5)

async function settle(page: Page) {
  await page.evaluate(() => new Promise<void>((resolve) => {
    let last = window.scrollY
    let since = performance.now()
    const check = () => {
      if (window.scrollY !== last) {
        last = window.scrollY
        since = performance.now()
      }
      if (performance.now() - since >= 250) resolve()
      else requestAnimationFrame(check)
    }
    requestAnimationFrame(check)
  }))
}

// Scrolls to a position, as a person does, and waits until it is still.
async function scrollTo(page: Page, y: number) {
  await page.evaluate((top) => window.scrollTo(0, top), y)
  await settle(page)
  return scrollY(page)
}

// Leaves the page by a link, at the scroll the page is at, as a tap on a link further down the page does.
async function leaveBy(page: Page, selector: string, which: "first" | "last") {
  await page.evaluate(({ selector, which }) => {
    const links = document.querySelectorAll<HTMLAnchorElement>(selector)
    links[which === "first" ? 0 : links.length - 1]!.click()
  }, { selector, which })
}

// A move through the header menu, as a person makes it: the page is at the top, so the menu is in reach.
async function menuTo(page: Page, label: string) {
  await scrollTo(page, 0)
  await page.getByRole("button", { name: "Open menu" }).click()
  await page.locator("#site-menu").getByRole("link", { name: label, exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`/${label.toLowerCase()}$`))
}

test.describe("Back in the installed app", () => {
  // WebKit sometimes logs a page's own prefetches as cut off when a reload follows; waiting for the network
  // to idle does not always prevent it, so those cut-off messages (and only those) are not errors here.
  test.use({ navigationCutOff: true })

  test.beforeEach(async ({ page, baseURL }) => {
    await page.context().addInitScript(standalone)
    await saveExams(page, baseURL!)
  })

  // Suspect 1: a reload forgets that the app was moved around, so Back goes up a level instead of back.
  test("after a reload, Back still goes to the page just before", async ({ page }) => {
    await page.goto("/")
    await menuTo(page, "PROGRESS")
    await expect(page).toHaveURL(/\/progress$/)
    await menuTo(page, "STUDY")
    await expect(page).toHaveURL(/\/study$/)
    // Let the pages' prefetches finish first, or WebKit logs them as cancelled.
    await page.waitForLoadState("networkidle")
    await page.reload()
    await expect(back(page)).toBeVisible()
    await back(page).click()
    // The page before is Progress. Going up a level would have been Home.
    await expect(page).toHaveURL(/\/progress$/)
  })

  // Suspect 2: the scroll is kept per path, so a path visited twice at different scrolls remembers only one.
  test("a page visited twice returns to the scroll of each visit", async ({ page }) => {
    await page.goto("/progress")
    const firstLeft = await scrollTo(page, 600)
    expect(firstLeft).toBeGreaterThan(300)
    await leaveBy(page, 'a[href^="/exam#"]', "last")
    await expect(page).toHaveURL(/\/exam#/)
    await menuTo(page, "PROGRESS")
    await expect(page).toHaveURL(/\/progress$/)
    const secondLeft = await scrollTo(page, 300)
    expect(Math.abs(secondLeft - firstLeft)).toBeGreaterThan(50)
    await leaveBy(page, 'a[href^="/exam#"]', "first")
    await expect(page).toHaveURL(/\/exam#/)
    await back(page).click()
    await expect(page).toHaveURL(/\/progress$/)
    await near(page, secondLeft)
    await back(page).click()
    await expect(page).toHaveURL(/\/exam#/)
    await back(page).click()
    await expect(page).toHaveURL(/\/progress$/)
    await near(page, firstLeft)
  })

  // Suspect 5: a double tap goes back twice.
  test("a double tap on Back goes back one page", async ({ page }) => {
    await page.goto("/")
    await menuTo(page, "PROGRESS")
    await expect(page).toHaveURL(/\/progress$/)
    await menuTo(page, "STUDY")
    await expect(page).toHaveURL(/\/study$/)
    await page.evaluate(() => {
      const button = document.querySelector<HTMLButtonElement>('button[aria-label="Back"]')!
      button.click()
      button.click()
    })
    await expect(page).toHaveURL(/\/progress$/)
    await page.waitForTimeout(1000)
    await expect(page).toHaveURL(/\/progress$/)
  })

  // Suspect 3: competing restorers. Once Back has put the scroll back, nothing moves it again.
  test("the scroll Back restores stays put", async ({ page }) => {
    await page.goto("/progress")
    const left = await scrollTo(page, 600)
    await leaveBy(page, 'a[href^="/exam#"]', "last")
    await expect(page).toHaveURL(/\/exam#/)
    await back(page).click()
    await expect(page).toHaveURL(/\/progress$/)
    await near(page, left)
    // The late restorers (Next's own, the hold) have all had their say by now.
    await page.waitForTimeout(2500)
    await near(page, left)
  })

  // Suspect 4: the scroll is saved after the move at popstate, so it can be saved under the wrong page.
  test("going back and then forward returns to where the later page was left", async ({ page }) => {
    await page.goto("/progress")
    const progressAt = await scrollTo(page, 600)
    await leaveBy(page, 'a[href^="/exam#"]', "last")
    await expect(page).toHaveURL(/\/exam#/)
    const examAt = await scrollTo(page, 250)
    await back(page).click()
    await expect(page).toHaveURL(/\/progress$/)
    await near(page, progressAt)
    await page.goForward()
    await expect(page).toHaveURL(/\/exam#/)
    await near(page, examAt)
    await page.goBack()
    await expect(page).toHaveURL(/\/progress$/)
    await near(page, progressAt)
  })

  // Not in the plan's list: Back after Back keeps walking back, one page each time, to where the app was opened.
  test("repeated Back walks back one page at a time", async ({ page }) => {
    await page.goto("/")
    await menuTo(page, "PROGRESS")
    await menuTo(page, "STUDY")
    await menuTo(page, "FLASHCARDS")
    await expect(page).toHaveURL(/\/flashcards$/)
    await back(page).click()
    await expect(page).toHaveURL(/\/study$/)
    await back(page).click()
    await expect(page).toHaveURL(/\/progress$/)
  })

  // A scroll that has not been saved yet is saved on the page it happened on, not on the page a native Back opens.
  test("a native Back right after a scroll keeps each page's own scroll", async ({ page }) => {
    await page.goto("/progress")
    const progressAt = await scrollTo(page, 600)
    await leaveBy(page, 'a[href^="/exam#"]', "last")
    await expect(page).toHaveURL(/\/exam#/)
    await scrollTo(page, 250)
    // Two frames, so the scroll event has fired and its save is waiting, then a native Back inside the wait.
    await page.evaluate(() => new Promise<void>((resolve) => {
      window.scrollTo(0, 320)
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    }))
    // The save is still waiting: the exam entry does not hold the new scroll yet.
    expect(await page.evaluate(() => Object.values(sessionStorage).some((value) => value.includes('"scroll":320')))).toBe(false)
    await page.goBack()
    await expect(page).toHaveURL(/\/progress$/)
    // The waiting save still lands on the exam entry, not the page Back opened.
    await expect.poll(() => page.evaluate(() => Object.entries(sessionStorage).some(([key, value]) => key.startsWith("quiz-entry:") && value.includes('"scroll":320')))).toBe(true)
    await near(page, progressAt)
    await page.goForward()
    await expect(page).toHaveURL(/\/exam#/)
    await near(page, 320)
  })

  // Going up a level leaves nothing behind: a link followed afterwards is a normal move, and Back returns to it.
  // (The push here completes at once; a push held open is covered by the flag naming its target path.)
  test("after going up a level, a later forward link still has Back return to its page", async ({ page }) => {
    await page.goto("/study/fundamentals")
    await back(page).click()
    await expect(page).toHaveURL(/\/study$/)
    await menuTo(page, "PROGRESS")
    await menuTo(page, "FLASHCARDS")
    await back(page).click()
    await expect(page).toHaveURL(/\/progress$/)
  })

  // A slow move up a level is still a move up: the page it opens counts as opened directly, however long the
  // move took, so the next Back goes up again instead of bouncing back to the page just left.
  test("a slow move up a level still has the next Back go up", async ({ page }) => {
    await page.goto("/study/fundamentals")
    await page.route(/\/study(\?|$)/, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1500))
      await route.continue()
    })
    await back(page).click()
    await expect(page).toHaveURL(/\/study$/, { timeout: 10000 })
    await page.unroute(/\/study(\?|$)/)
    await back(page).click()
    await expect(page).toHaveURL(/\/$/)
  })
})
