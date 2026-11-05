import type { Page } from "@playwright/test"
import { test, expect, readyOffline, openVoice } from "./fixtures"

test.use({ offlineNetwork: true })

type NightReady = {
  state: "ready"
  key: string
  bytes: number
  chapters: { courseId: string; courseTitle: string; title: string }[]
}

async function readyNight(page: Page, exam: string): Promise<NightReady> {
  const headers = { "x-quiz-exam": exam }
  await expect.poll(async () => {
    const response = await page.request.get("/api/night", { headers })
    expect(response.status()).toBe(200)
    return (await response.json()).state
  }, { timeout: 30_000 }).toBe("ready")
  const response = await page.request.get("/api/night", { headers })
  expect(response.status()).toBe(200)
  return await response.json() as NightReady
}

async function settleOfflineWorker(page: Page): Promise<void> {
  await page.waitForLoadState("networkidle")
  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration()
    if (!registration) throw new Error("The offline worker is not registered")
    await registration.update()
  })
  await expect.poll(() => page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration()
    return !!registration && !registration.installing && !registration.waiting
  })).toBe(true)
}

test("Cached pages open with the server unreachable; queued answers sync once online", async ({ context, page }) => {
  await page.goto("/progress")
  await readyOffline(page)
  await context.setOffline(true)
  for (const path of ["/", "/exam", "/practice", "/flashcards", "/glossary", "/study", "/study/fundamentals", "/study/fundamentals/introduction", "/progress", "/read", "/read/1", "/read/1/e2e-first", "/read/night", "/about"]) {
    const response = await page.goto(path)
    expect(response?.status(), path).toBe(200)
    await expect(page.locator("h1")).not.toBeEmpty()
  }
  await page.goto("/practice")
  await page.getByRole("button", { name: /^A\./ }).click()
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("quiz-outbox-generative-ai-leader") ?? "[]").length)).toBe(1)
  const queuedId: string = await page.evaluate(() => JSON.parse(localStorage.getItem("quiz-outbox-generative-ai-leader") ?? "[]")[0].id)
  await page.reload()
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("quiz-outbox-generative-ai-leader") ?? "[]").length)).toBe(1)
  await context.setOffline(false)
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("quiz-outbox-generative-ai-leader") ?? "[]").length)).toBe(0)
  const response = await page.request.get("/api/snapshot")
  expect(await response.json()).toMatchObject({
    ok: true, snapshot: { lines: [expect.objectContaining({ id: queuedId, mode: "practice" })] },
  })
})

test("Voice quiz accepts an offline answer without reloading and sends it after reconnection", async ({ context, page }) => {
  await openVoice(page)
  await readyOffline(page)
  await context.setOffline(true)
  await page.getByRole("button", { name: /^A\./ }).click()
  await expect(page.getByRole("button", { name: /^A\./ })).toBeDisabled()
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("quiz-outbox-generative-ai-leader") ?? "[]").length)).toBe(1)
  await context.setOffline(false)
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("quiz-outbox-generative-ai-leader") ?? "[]").length)).toBe(0)
  const response = await page.request.get("/api/snapshot")
  expect(await response.json()).toMatchObject({
    ok: true, snapshot: { lines: [expect.objectContaining({ mode: "round" })] },
  })
})

test.describe("exam changes", () => {
  test.use({ navigationCutOff: true })

  test("Night recordings and places stay with their exams, including a legacy recording", async ({ context, page, baseURL }) => {
    test.setTimeout(180_000)
    const origin = { origin: baseURL! }
    try {
      await page.goto("/read/night")
      const first = await readyNight(page, "generative-ai-leader")
      expect(first.chapters[0]?.courseTitle).toBe("Gen AI: Beyond the Chatbot")
      const legacyStatus = await page.request.get("/api/night")
      expect(legacyStatus.status()).toBe(200)
      expect(await legacyStatus.json()).toMatchObject({ state: "ready", key: first.key })
      expect((await page.request.get(`/api/night/audio/${first.key}`)).status()).toBe(200)
      const audio = await page.request.get(`/api/night/audio/${first.key}`, { headers: { "x-quiz-exam": "generative-ai-leader" } })
      expect(audio.status()).toBe(200)
      const bytes = await audio.body()
      expect(bytes.length).toBe(first.bytes)
      expect(bytes.subarray(4, 8).toString()).toBe("ftyp")
      await page.getByRole("button", { name: /^Store on this device/ }).click()
      await expect(page.getByRole("button", { name: "Play", exact: true })).toBeVisible()
      await readyOffline(page)

      // Recreate the pre-pack storage names, then reopen the same recording without the Mac.
      await page.evaluate(async (key) => {
        const scopedPlace = "night-place-generative-ai-leader"
        const place = localStorage.getItem(scopedPlace)
        if (!place) throw new Error("The default exam's place was not stored")
        const cache = await caches.open("quiz-night")
        const scopedAudio = `/api/night/audio/${key}?exam=generative-ai-leader`
        const response = await cache.match(scopedAudio)
        if (!response) throw new Error("The default exam's audio was not stored")
        await cache.put(`/api/night/audio/${key}`, response)
        await cache.delete(scopedAudio)
        localStorage.setItem("night-place", place)
        localStorage.removeItem(scopedPlace)
      }, first.key)
      await context.setOffline(true)
      await page.reload()
      await expect(page.getByRole("button", { name: "Play", exact: true })).toBeVisible()
      await expect.poll(() => page.evaluate(() => localStorage.getItem("night-place-generative-ai-leader"))).not.toBeNull()
      await page.getByRole("button", { name: "Play", exact: true }).click()
      await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeVisible()
      await expect(page.getByRole("status").filter({ hasText: "Gen AI: Beyond the Chatbot" })).toBeVisible()

      await context.setOffline(false)
      expect((await page.request.post("/api/exam", { headers: origin, data: { exam: "agentic-architect" } })).ok()).toBe(true)
      for (const path of ["/api/night", `/api/night/audio/${first.key}`]) {
        const refused = await page.request.get(path, { headers: { "x-quiz-exam": "generative-ai-leader" } })
        expect(refused.status(), path).toBe(409)
      }
      await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")))
      await expect(page.locator("html")).toHaveAttribute("data-exam", "agentic-architect")
      await settleOfflineWorker(page)
      const second = await readyNight(page, "agentic-architect")
      expect(second.key).not.toBe(first.key)
      expect(second.chapters[0]?.courseTitle).toBe("Manage Agent Memory and State")
      expect(second.chapters.some((chapter) => chapter.title === "Test Rise reading one")).toBe(true)
      const oldStatus = await page.request.get("/api/night")
      expect(oldStatus.status()).toBe(409)
      expect(await oldStatus.json()).toMatchObject({ state: "failed", wrongExam: "agentic-architect", error: /Reload Night reading/ })
      expect((await page.request.get(`/api/night/audio/${second.key}`)).status()).toBe(409)
      await expect(page.getByRole("button", { name: "Play", exact: true })).toHaveCount(0)
      await page.getByRole("button", { name: /^Store on this device/ }).click()
      await expect(page.getByRole("button", { name: "Play", exact: true })).toBeVisible()
      await readyOffline(page)
      await context.setOffline(true)
      await page.reload()
      await page.getByRole("button", { name: "Play", exact: true }).click()
      await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeVisible()
      await expect(page.getByRole("status").filter({ hasText: "Manage Agent Memory and State" })).toBeVisible()

      await context.setOffline(false)
      await page.goto("/progress")
      await page.getByLabel("Exam", { exact: true }).selectOption("generative-ai-leader")
      await page.getByRole("button", { name: "Switch exam", exact: true }).click()
      await expect(page.locator("html")).toHaveAttribute("data-exam", "generative-ai-leader")
      await page.goto("/read/night")
      await expect(page.getByRole("button", { name: "Play", exact: true })).toBeVisible()
      await expect(page.getByRole("status").filter({ hasText: "Gen AI: Beyond the Chatbot" })).toBeVisible()
      const stored = await page.evaluate(async ({ firstKey, secondKey }) => {
        const cache = await caches.open("quiz-night")
        return {
          first: !!await cache.match(`/api/night/audio/${firstKey}`),
          second: !!await cache.match(`/api/night/audio/${secondKey}?exam=agentic-architect`),
          secondPlace: !!localStorage.getItem("night-place-agentic-architect"),
        }
      }, { firstKey: first.key, secondKey: second.key })
      expect(stored).toEqual({ first: true, second: true, secondPlace: true })
    } finally {
      await context.setOffline(false)
      await page.request.post("/api/exam", { headers: origin, data: { exam: "generative-ai-leader" } })
    }
  })

  test("an answer queued before another device switches exams is kept and sent once", async ({ browser, context, page, baseURL }) => {
    const origin = { origin: baseURL! }
    const other = await browser.newContext({ baseURL })
    try {
      await page.goto("/progress")
      await readyOffline(page)
      await context.setOffline(true)
      await page.goto("/practice")
      await page.getByRole("button", { name: /^A\./ }).click()
      const queue = () => page.evaluate(() => JSON.parse(localStorage.getItem("quiz-outbox-generative-ai-leader") ?? "[]") as { id: string }[])
      await expect.poll(async () => (await queue()).length).toBe(1)
      const queuedId = (await queue())[0]!.id

      expect((await other.request.post("/api/exam", { headers: origin, data: { exam: "agentic-architect" } })).ok()).toBe(true)
      const refused = page.waitForResponse((response) =>
        response.url().endsWith("/api/scores") && response.request().method() === "POST" && response.status() === 409,
      )
      await context.setOffline(false)
      expect((await refused).status()).toBe(409)
      await expect(page.locator("html")).toHaveAttribute("data-exam", "agentic-architect")
      expect((await queue()).map((answer) => answer.id)).toEqual([queuedId])
      const otherSnapshot = await page.request.get("/api/snapshot", { headers: { "x-quiz-exam": "agentic-architect" } })
      const otherLines = (await otherSnapshot.json()).snapshot.lines as { id: string }[]
      expect(otherLines.some((line) => line.id === queuedId)).toBe(false)

      expect((await other.request.post("/api/exam", { headers: origin, data: { exam: "generative-ai-leader" } })).ok()).toBe(true)
      await page.goto("/progress")
      await expect.poll(async () => (await queue()).length).toBe(0)
      const originalSnapshot = await page.request.get("/api/snapshot", { headers: { "x-quiz-exam": "generative-ai-leader" } })
      const originalLines = (await originalSnapshot.json()).snapshot.lines as { id: string }[]
      expect(originalLines.filter((line) => line.id === queuedId)).toHaveLength(1)
    } finally {
      await context.setOffline(false)
      await other.request.post("/api/exam", { headers: origin, data: { exam: "generative-ai-leader" } })
      await other.close()
    }
  })

  test("an Agentic Rise reading opens, saves progress and reopens offline", async ({ context, page, baseURL }) => {
    const origin = { origin: baseURL! }
    try {
      expect((await page.request.post("/api/exam", { headers: origin, data: { exam: "agentic-architect" } })).ok()).toBe(true)
      expect((await page.request.post("/api/scores/reset", {
        headers: { ...origin, "x-quiz-exam": "agentic-architect" }, data: { confirm: true },
      })).ok()).toBe(true)
      await page.goto("/progress")
      await readyOffline(page)
      await page.goto("/read/5")
      await page.getByRole("link", { name: /Test Rise reading one/ }).click()
      await expect(page.locator("main")).toContainText("Rise introduction")
      await expect(page.locator("main")).toContainText("Rise item")
      await expect(page.locator("main")).toContainText("Rise ending tail")
      await expect(page.locator("main")).not.toContainText("</div>")
      const saved = page.waitForResponse((response) =>
        response.url().endsWith("/api/scores") && response.request().method() === "POST",
      )
      await page.getByRole("button", { name: "MARK AS READ", exact: true }).click()
      const savedResponse = await saved
      expect(savedResponse.ok()).toBe(true)
      expect((await savedResponse.json()).stored).toHaveLength(1)
      await expect(page.getByRole("button", { name: "✓ MARKED AS READ TODAY" })).toBeVisible()
      const snapshot = await page.request.get("/api/snapshot", { headers: { "x-quiz-exam": "agentic-architect" } })
      expect(await snapshot.json()).toMatchObject({
        ok: true, snapshot: { lines: expect.arrayContaining([expect.objectContaining({ mode: "reading", asked: ["5/000000000000000000000001"] })]) },
      })
      await page.getByRole("link", { name: /Test Rise reading two/ }).click()
      await expect(page.locator("main")).toContainText("This is the second synthetic Rise reading.")
      await context.setOffline(true)
      const reopened = await page.goto("/read/5/000000000000000000000001")
      expect(reopened?.status()).toBe(200)
      await expect(page.locator("main")).toContainText("Rise ending tail")
      await expect(page.getByRole("button", { name: "✓ MARKED AS READ TODAY" })).toBeVisible()
    } finally {
      await context.setOffline(false)
      await page.request.post("/api/exam", { headers: origin, data: { exam: "generative-ai-leader" } })
    }
  })
})

test("The second exam opens offline too, and its queued answer syncs under its own name", async ({ context, page, baseURL }) => {
  test.setTimeout(180_000)
  const origin = { origin: baseURL! }
  try {
    expect((await page.request.post("/api/exam", { headers: origin, data: { exam: "agentic-architect" } })).ok()).toBe(true)
    // The fixture clears only the first exam's scratch scores, so clear this exam's too.
    expect((await page.request.post("/api/scores/reset", { headers: { ...origin, "x-quiz-exam": "agentic-architect" }, data: { confirm: true } })).ok()).toBe(true)
    await page.goto("/progress")
    await readyOffline(page)
    // The exam's own pages are in the worker's list; wait for it to hold the study pages before going offline.
    await expect.poll(() => page.evaluate(async () => (await caches.keys()).length > 0)).toBe(true)
    await page.waitForLoadState("networkidle")
    await context.setOffline(true)
    for (const path of ["/", "/exam", "/practice", "/flashcards", "/glossary", "/study", "/study/low-code", "/study/low-code/1-1", "/progress", "/read", "/about"]) {
      const response = await page.goto(path)
      expect(response?.status(), path).toBe(200)
      await expect(page.locator("h1")).not.toBeEmpty()
    }
    await page.goto("/practice")
    await page.getByRole("button", { name: /^A\./ }).click()
    const queue = () => page.evaluate(() => JSON.parse(localStorage.getItem("quiz-outbox-agentic-architect") ?? "[]").length)
    await expect.poll(queue).toBe(1)
    const queuedId: string = await page.evaluate(() => JSON.parse(localStorage.getItem("quiz-outbox-agentic-architect") ?? "[]")[0].id)
    await context.setOffline(false)
    await expect.poll(queue).toBe(0)
    const response = await page.request.get("/api/snapshot", { headers: { "x-quiz-exam": "agentic-architect" } })
    expect(await response.json()).toMatchObject({ ok: true, snapshot: { lines: [expect.objectContaining({ id: queuedId, mode: "practice" })] } })
    // The first exam's queue was never touched.
    expect(await page.evaluate(() => localStorage.getItem("quiz-outbox-generative-ai-leader"))).toBeNull()
  } finally {
    await context.setOffline(false)
    await page.request.post("/api/exam", { headers: origin, data: { exam: "generative-ai-leader" } })
  }
})
