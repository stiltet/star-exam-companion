import { test, expect } from "./fixtures"

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
