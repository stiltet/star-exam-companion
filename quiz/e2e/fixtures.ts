import { test as base, expect, type Page } from "@playwright/test"

// A page load that interrupts the page it replaces, as switching the exam does, makes WebKit report the requests and
// storage calls it cut off as uncaught errors.
const CUT_OFF = /^Context is stopped$|due to access control checks\.$/

export const test = base.extend<{ browserChecks: void; offlineNetwork: boolean; navigationCutOff: boolean; expectedWrongExam: boolean }>({
  offlineNetwork: [false, { option: true }],
  navigationCutOff: [false, { option: true }],
  expectedWrongExam: [false, { option: true }],
  browserChecks: [async ({ context, page, baseURL, offlineNetwork, navigationCutOff, expectedWrongExam }, use) => {
    const errors: string[] = []
    page.on("pageerror", (error) => {
      // WebKit reports refused offline prefetches and background voice downloads as pageerrors.
      if (offlineNetwork && /(?:[?&]_rsc=|\/api\/speak\/).+ due to access control checks\.$/.test(error.message)) return
      if (navigationCutOff && CUT_OFF.test(error.message)) return
      errors.push(error.message)
    })
    page.on("console", (message) => {
      if (message.type() !== "error") return
      // Disconnected API calls and uncached RSC prefetches are expected in the offline test.
      if (offlineNetwork && /^Failed to load resource:/.test(message.text())) {
        const url = new URL(message.location().url || baseURL!)
        if (url.pathname.startsWith("/api/") || url.searchParams.has("_rsc") || /^\/(?:favicon|apple-touch-icon)\.png$/.test(url.pathname)) return
      }
      if (offlineNetwork && /(?:[?&]_rsc=|\/api\/).+ due to access control checks\.$/.test(message.text())) return
      if (navigationCutOff && CUT_OFF.test(message.text())) return
      if (expectedWrongExam && /status of 409\b/.test(message.text()) && new URL(message.location().url || baseURL!).pathname === "/api/snapshot") return
      errors.push(message.text())
    })
    await context.addInitScript(() => {
      HTMLMediaElement.prototype.play = () => Promise.resolve()
    })
    await context.route(/\/api\/speak(?:\/|$|\?)/, (route) =>
      route.fulfill({
        contentType: "audio/wav",
        body: Buffer.from("UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=", "base64"),
      }),
    )
    const reset = await page.request.post("/api/scores/reset", {
      headers: { origin: baseURL! },
      data: { confirm: true },
    })
    expect(reset.ok(), "Reset only the server's scratch scores before each test").toBe(true)
    await use()
    await context.setOffline(false)
    if (!page.isClosed()) {
      await page.evaluate(async () => {
        const workers = await navigator.serviceWorker.getRegistrations()
        await Promise.all(workers.map((worker) => worker.unregister()))
      })
    }
    expect(errors, "Uncaught browser errors").toEqual([])
  }, { auto: true }],
})

export { expect }

export async function openVoice(page: Page, beforeVoice?: () => Promise<void>) {
  await page.goto("/progress")
  await page.waitForLoadState("networkidle")
  await beforeVoice?.()
  await page.getByRole("button", { name: "Open menu" }).click()
  await page.locator("header").getByRole("link", { name: /voice quiz/i }).filter({ visible: true }).click()
  await expect(page.getByRole("button", { name: /^A\./ })).toBeVisible()
}

export async function answerPractice(page: Page) {
  await page.goto("/practice")
  await page.getByRole("button", { name: /^A\./ }).click()
  await expect(page.getByText(/^(?:CORRECT|INCORRECT) — EXPLANATION$/)).toBeVisible()
  await page.waitForLoadState("networkidle")
}

export async function readyOffline(page: Page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
    if (!navigator.serviceWorker.controller) {
      await new Promise<void>((resolve) => navigator.serviceWorker.addEventListener("controllerchange", () => resolve(), { once: true }))
    }
  })
}
