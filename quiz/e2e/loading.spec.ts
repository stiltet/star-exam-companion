import { test, expect } from "./fixtures"
import type { Page } from "@playwright/test"

// The loading feedback the owner agreed: the tapped link shows loading after 200 ms, every other link is refused
// until the page arrives, a loading button never goes back to normal by itself, the logo link shows a page-sized box
// instead of changing the header, and a hidden page is shown after 5 seconds whatever happens to its scripts.
const slow = (ms: number) => async (route: { continue: () => Promise<void> }) => {
  await new Promise((resolve) => setTimeout(resolve, ms))
  await route.continue()
}

test("the tapped link fills after 200 ms, other links are refused for the first 6 seconds, and it never goes back to normal before the page arrives", async ({ page }) => {
  // A page the app has not already fetched in the background (the card near the bottom of Home), held for 8 s.
  await page.route(/\/flashcards(\?|$)/, slow(8000))
  await page.goto("/")
  const study = page.locator('main a[href="/flashcards"]').first()
  // Time the tap and the moment loading shows, in the page, so the 200 ms threshold is measured and not assumed.
  await study.evaluate((el) => {
    const times: { click?: number; shown?: number } = {}
    ;(window as unknown as { __times: typeof times }).__times = times
    el.addEventListener("click", () => { times.click = performance.now() }, true)
    new MutationObserver(() => {
      if (el.hasAttribute("data-loading")) times.shown ??= performance.now()
    }).observe(el, { attributes: true })
  })
  await study.click()
  await expect(study).toHaveAttribute("data-loading", "true")
  await expect(study).toHaveAttribute("aria-busy", "true")
  await expect(study, "the words are gone from the screen but the name stays").toHaveAttribute("aria-label", /flashcards/i)
  const { click, shown } = await page.evaluate(() => (window as unknown as { __times: { click: number; shown: number } }).__times)
  expect(shown - click, "loading shows about 200 ms after the tap, not at once and not late").toBeGreaterThanOrEqual(150)
  expect(shown - click).toBeLessThanOrEqual(600)
  // Another link is refused while the page is coming: a second later the page has still not moved.
  await page.locator('main a[href="/exam"]').first().click({ force: true })
  await page.waitForTimeout(1000)
  await expect(page).toHaveURL(/\/$/)
  // The 6 s failsafe lifts the refusal of other links (so the app can never stay locked), but the tapped
  // button is still loading after it: it never goes back to normal by itself.
  await page.waitForTimeout(6500)
  await expect(study).toHaveAttribute("data-loading", "true")
  await expect(page).toHaveURL(/\/$/)
  // After the failsafe another link works again.
  await page.locator('main a[href="/exam"]').first().click()
  await expect(page).toHaveURL(/\/exam$/, { timeout: 15_000 })
  // The page that arrives ends the loading.
  await expect(page.locator("[data-loading]")).toHaveCount(0)
})

test("a tapped link that arrives ends its loading", async ({ page }) => {
  await page.route(/\/flashcards(\?|$)/, slow(1500))
  await page.goto("/")
  const study = page.locator('main a[href="/flashcards"]').first()
  await study.click()
  await expect(study).toHaveAttribute("data-loading", "true")
  await expect(page).toHaveURL(/\/flashcards$/, { timeout: 15_000 })
  await expect(page.locator("[data-loading]")).toHaveCount(0)
  // The refusal of other links ended with the move: the logo link, which lives in the header that survives it, works at once
  // (the 6 s failsafe is not what freed it, as the page arrived after 1.5 s).
  await page.locator("header a:has(img)").first().click()
  await expect(page).toHaveURL(/\/$/, { timeout: 3000 })
})

test("the logo link never changes itself: a page-sized loading box shows instead", async ({ page }) => {
  await page.route((url) => url.pathname === "/", slow(3000))
  await page.goto("/glossary", { waitUntil: "domcontentloaded" })
  const logo = page.locator("header a:has(img)").first()
  await logo.click()
  const box = page.getByRole("status", { name: "Loading" })
  await expect(box).toBeVisible()
  await expect(logo, "the header keeps its look").not.toHaveAttribute("data-loading", /.*/)
  // Owner, 24 Nov: never half a page. Nothing of the page is seen beside the box, so the header and bars are not either.
  await expect(page.locator("header").first(), "the page behind the box is not seen").toBeHidden()
  await expect(page.locator("main").first()).toBeHidden()
  await expect(page).toHaveURL(/localhost:\d+\/$/, { timeout: 15_000 })
  await expect(box).toHaveCount(0)
})

test("a page whose scripts are slow is shown after 5 seconds, by CSS alone", async ({ page }) => {
  await page.route(/\/_next\/static\/.*\.js/, slow(9000))
  await page.goto("/glossary", { waitUntil: "commit" })
  const gate = page.locator("[data-page-ready]")
  await expect(gate, "hidden while the page is not ready").toHaveCSS("visibility", "hidden")
  await expect(gate, "shown after 5 s with what the server drew").toHaveCSS("visibility", "visible", { timeout: 6500 })
  await expect(page.locator("main")).toBeVisible()
  await page.unroute(/\/_next\/static\/.*\.js/)
})

test("a move that changes only the query (a Practice filter) loads the tapped link and locks the others", async ({ page }) => {
  // Held before the page opens, so the filter's data is not already fetched in the background when it is tapped.
  await page.route(/\/practice\?section=1(&|$)/, slow(3000))
  await page.goto("/practice")
  const filter = page.locator('main a[href="/practice?section=1"]').first()
  await filter.click()
  await expect(filter).toHaveAttribute("data-loading", "true")
  await page.locator('main a[href="/practice?section=2"]').first().click({ force: true })
  await page.waitForTimeout(500)
  await expect(page).not.toHaveURL(/section=2/)
  await expect(page).toHaveURL(/section=1/, { timeout: 15_000 })
  await expect(page.locator("[data-loading]")).toHaveCount(0)
})

// A path as a regular expression that matches it exactly, with every character that has a meaning in one (the backslash too) escaped.
const pathPattern = (path: string, tail: string) => new RegExp(`${path.replace(/[\\^$.*+?()[\]{}|/]/g, "\\$&")}${tail}`)

// Taps the Read Aloud link to `path` while its page is held back `delay` ms, and samples every frame. `blockMs`: the first frame after the
// route box mounts is made late by that much (the main thread is busy, as on a phone), so the box is seen later than it mounted.
const handOver = async (page: Page, delay: number, { path = "/read/1", blockMs = 0 } = {}) => {
  // Only the move itself is held, not the app's background fetch of the page, which would leave nothing to show at the tap.
  await page.route(pathPattern(path, "(\\?|$)"), async (route) => {
    if (route.request().headers()["next-router-prefetch"]) return route.continue()
    await new Promise((resolve) => setTimeout(resolve, delay))
    await route.continue()
  })
  // The app fetches the page ahead in the background once the link is on screen; the tap is made after that, or there would be nothing held to show.
  const fetchedAhead = page
    .waitForResponse((response) => response.url().includes(path) && response.request().headers()["next-router-prefetch"] !== undefined)
    // When the 1.5 s below wins, this wait is left pending and would end in an error when the page closes: that is not a failure.
    .catch(() => undefined)
  await page.goto("/read")
  await expect(page.locator('[data-page-ready="true"]')).toHaveCount(1)
  await Promise.race([fetchedAhead, page.waitForTimeout(1500)])
  await page.evaluate((block) => {
    if (block > 0) {
      new MutationObserver((records) => {
        const added = records.some((record) => [...record.addedNodes].some((node) => node instanceof Element && (node.matches(".loading-route") || node.querySelector(".loading-route"))))
        if (added) for (const until = performance.now() + block; performance.now() < until; );
      }).observe(document.body, { childList: true, subtree: true })
    }
    const seen = { route: false, firstAt: 0, lastAt: 0, gap: false, texts: [] as string[], timeline: [] as string[] }
    ;(window as unknown as { __hand: typeof seen }).__hand = seen
    const frame = () => {
      // The hidden launch cover is always in the page, so it is not a box that shows.
      const box = [...document.querySelectorAll('[role="status"][aria-label="Loading"]')].find((el) => !el.closest(".resume-cover"))
      const now = performance.now()
      const kind = box ? (box.classList.contains("loading-route") ? "route" : box.classList.contains("page-loading") ? "gate" : "other") : "none"
      if (seen.timeline[seen.timeline.length - 1]?.split("@")[0] !== kind) seen.timeline.push(`${kind}@${Math.round(now)}`)
      // The route box is in the page from the start but shows only after 200 ms (its opacity): time it from when it can be seen.
      if (box && getComputedStyle(box).opacity === "1") {
        seen.firstAt ||= now
        seen.lastAt = now
        if (box.classList.contains("loading-route")) seen.route = true
        if (box.textContent?.trim()) seen.texts.push(box.textContent.trim())
      } else if (!box && seen.firstAt && (location.pathname === "/read" || document.querySelector('[data-page-ready="false"]'))) {
        // A moment with the move still under way and no box on screen.
        seen.gap = true
      }
      requestAnimationFrame(frame)
    }
    requestAnimationFrame(frame)
  }, blockMs)
  await page.locator(`main a[href="${path}"]`).first().click()
  await expect(page).toHaveURL(pathPattern(path, "$"), { timeout: 15_000 })
  // The route box stays until the course page is there, then the page gate's own box (if the page is not yet shown) takes over.
  await expect(page.locator(".loading-route")).toHaveCount(0, { timeout: 15_000 })
  await expect(page.locator('[data-page-ready="true"]')).toHaveCount(1)
  await expect(page.locator('[role="status"][aria-label="Loading"].loading-full, .page-loading')).toHaveCount(0)
  const seen = await page.evaluate(() => (window as unknown as { __hand: { route: boolean; firstAt: number; lastAt: number; gap: boolean; texts: string[]; timeline: string[] } }).__hand)
  expect(seen.route, "the Read Aloud box showed while the course came").toBe(true)
  expect(seen.texts, "and held no text").toEqual([])
  expect(seen.gap, "the box was never gone while the move was under way").toBe(false)
  expect(seen.lastAt - seen.firstAt, `a loading screen that showed stayed at least 500 ms on screen, within one frame (${seen.timeline.join(" ")})`).toBeGreaterThanOrEqual(480)
}

test("Read Aloud shows only the app's own loading box while a course loads, with no text, and the page gate takes over without a gap", async ({ page }) => {
  await handOver(page, 2000)
})

test("the night reading page keeps the loading screen for 500 ms too when it comes quickly", async ({ page }) => {
  await handOver(page, 400, { path: "/read/night" })
})

test("a loading box seen late keeps its 500 ms from when it was seen, not from when it mounted", async ({ page }) => {
  // The first frame after the box mounts comes 100 ms late: counting from the mount would take the box away 100 ms early.
  await handOver(page, 400, { blockMs: 100 })
})

test("a tapped link that shows loading keeps it for 500 ms when the page comes right after", async ({ page }) => {
  // The page is there 300 ms after the tap: the link shows loading at 200 ms, so only the hold keeps it past the page.
  await page.route(/\/practice\?section=1(&|$)/, slow(300))
  await page.goto("/practice")
  await expect(page.locator('[data-page-ready="true"]')).toHaveCount(1)
  await page.evaluate(() => {
    const seen: { shown?: number; gone?: number } = {}
    ;(window as unknown as { __link: typeof seen }).__link = seen
    const frame = () => {
      const now = performance.now()
      if (document.querySelector("a[data-loading]")) {
        seen.shown ??= now
        seen.gone = undefined
      } else if (seen.shown !== undefined) seen.gone ??= now
      requestAnimationFrame(frame)
    }
    requestAnimationFrame(frame)
  })
  await page.locator('main a[href="/practice?section=1"]').first().click()
  await expect(page).toHaveURL(/section=1/, { timeout: 15_000 })
  await expect.poll(() => page.evaluate(() => (window as unknown as { __link: { gone?: number } }).__link.gone), { message: "the loading link went", timeout: 10_000 }).toBeDefined()
  const { shown, gone } = await page.evaluate(() => (window as unknown as { __link: { shown?: number; gone?: number } }).__link)
  expect(gone! - shown!, "the tapped link stayed loading at least 500 ms, within one frame").toBeGreaterThanOrEqual(480)
})

test("a page that is ready before its box shows but settles after it keeps the box 500 ms from when it showed", async ({ page }) => {
  await page.addInitScript(() => {
    // The fonts are reported loaded only 300 ms after they are asked for, so the next page settles after its box has shown (200 ms).
    Object.defineProperty(FontFaceSet.prototype, "ready", {
      get: () => new Promise((resolve) => setTimeout(resolve, 300)),
      configurable: true,
    })
  })
  await page.goto("/")
  await expect(page.locator('[data-page-ready="true"]')).toHaveCount(1)
  await page.evaluate(() => {
    const seen: { firstAt?: number; lastAt?: number } = {}
    ;(window as unknown as { __gate: typeof seen }).__gate = seen
    const frame = () => {
      const box = document.querySelector(".page-loading")
      if (box && getComputedStyle(box).opacity === "1") {
        const now = performance.now()
        seen.firstAt ??= now
        seen.lastAt = now
      }
      requestAnimationFrame(frame)
    }
    requestAnimationFrame(frame)
  })
  await page.locator('main a[href="/study"]').first().click()
  await expect(page).toHaveURL(/\/study$/, { timeout: 15_000 })
  await expect(page.locator('[data-page-ready="true"]')).toHaveCount(1)
  const seen = await page.evaluate(() => (window as unknown as { __gate: { firstAt?: number; lastAt?: number } }).__gate)
  expect(seen.firstAt, "the box showed while the page settled").toBeDefined()
  expect(seen.lastAt! - seen.firstAt!, "and stayed 500 ms from when it showed, within one frame").toBeGreaterThanOrEqual(480)
})
