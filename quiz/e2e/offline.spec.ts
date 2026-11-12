import type { Page } from "@playwright/test"
import { test, expect, readyOffline, openVoice } from "./fixtures"

test.use({ offlineNetwork: true })

type NightReady = {
  state: "ready"
  key: string
  bytes: number
  chapters: { courseId: string; courseTitle: string; title: string }[]
}

// A silent device voice. It records what it is asked to say in window.__spoken, counts cancels in window.__cancelled, and ends
// each sentence itself after 300 ms (or options.ms). With clips: "ok-then-fail" the page's first request for a Mac clip gets a good answer and every later one a 500, with audioEnds: true each clip "plays" for 50 ms and then ends, so a test can reach the second request while the first clip plays. With hold: true no sentence ends by itself: it stays being said until the test calls window.__release(), so a test can pause or leave at an exact moment. With voices: false the browser lists no voice and never says it loaded one. It must
// stay self-contained: Playwright sends its source into the page.
function voiceStub(options: { voices: boolean; ms?: number; hold?: boolean; clips?: "ok-then-fail"; audioEnds?: boolean }) {
  const w = window as unknown as Record<string, unknown>
  w.__spoken = []
  w.__cancelled = 0
  class Utterance {
    text: string
    voice: unknown = null
    lang = ""
    onboundary: ((event: { name: string; charIndex: number }) => void) | null = null
    onend: (() => void) | null = null
    onerror: ((event: { error: string }) => void) | null = null
    constructor(text: string) {
      this.text = text
    }
  }
  // Counts the page's own requests for a clip from the Mac, however they are routed, so a test can say how many were made.
  w.__clipRequests = 0
  const realFetch = window.fetch.bind(window)
  window.fetch = (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url
    if (new URL(url, location.href).pathname === "/api/speak/reading") {
      const count = ++(w.__clipRequests as number)
      if (options.clips === "ok-then-fail") {
        return Promise.resolve(count === 1 ? new Response(new Blob(["audio"]), { status: 200 }) : new Response("{}", { status: 500 }))
      }
    }
    return realFetch(input, init)
  }
  if (options.audioEnds) {
    HTMLMediaElement.prototype.play = function play(this: HTMLMediaElement) {
      // Only a clip from the Mac (a blob address) ends; the silent clip the page plays inside the tap must not, or each
      // sentence would be ended twice.
      if (this.src.startsWith("blob:")) window.setTimeout(() => this.onended?.(new Event("ended")), 50)
      return Promise.resolve()
    }
  }
  let timer: number | undefined
  const voices = options.voices ? [{ name: "Synthetic local", lang: "en-US", localService: true }, { name: "Synthetic remote", lang: "en-GB", localService: false }] : []
  Object.defineProperty(window, "SpeechSynthesisUtterance", { value: Utterance, configurable: true })
  Object.defineProperty(window, "speechSynthesis", {
    configurable: true,
    value: {
      getVoices: () => voices,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      cancel: () => {
        ;(w.__cancelled as number)++
        window.clearTimeout(timer)
        // __release is left as it is on purpose: calling it after a cancel must change nothing, which is what a test
        // of leaving the page relies on.
      },
      speak: (utterance: Utterance) => {
        ;(w.__spoken as string[]).push(utterance.text)
        if ((utterance.voice as { localService?: boolean } | null)?.localService !== true) throw new Error("A non-local voice was chosen")
        utterance.onboundary?.({ name: "word", charIndex: 0 })
        if (options.hold) {
          w.__release = () => {
            w.__release = undefined
            utterance.onend?.()
          }
          return
        }
        timer = window.setTimeout(() => utterance.onend?.(), options.ms ?? 300)
      },
    },
  })
}

const spokenNow = (page: Page) => page.evaluate(() => (window as unknown as { __spoken: string[] }).__spoken)
const cancelledNow = (page: Page) => page.evaluate(() => (window as unknown as { __cancelled: number }).__cancelled)
const releaseNow = (page: Page) => page.evaluate(() => (window as unknown as { __release?: () => void }).__release?.())
const clipRequests = (page: Page) => page.evaluate(() => (window as unknown as { __clipRequests: number }).__clipRequests)

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
      // An older build's unnamed recording of this exam is replaced by the one now stored.
      const staleKey = "c".repeat(64)
      await page.evaluate(async (stale) => {
        const cache = await caches.open("quiz-night")
        await cache.put(`/api/night/audio/${stale}`, new Response("old", { headers: { "Content-Type": "audio/mp4" } }))
      }, staleKey)
      await page.getByRole("button", { name: /^Store on this device/ }).click()
      await expect(page.getByRole("button", { name: "Play", exact: true })).toBeVisible()
      await readyOffline(page)
      expect(await page.evaluate(async (stale) => {
        const cache = await caches.open("quiz-night")
        return !!await cache.match(`/api/night/audio/${stale}`)
      }, staleKey)).toBe(false)

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
      expect(second.chapters[0]?.courseTitle).toBe("Understand Google Cloud Agents")
      expect(second.chapters.some((chapter) => chapter.title === "Test Rise reading one")).toBe(true)
      const oldStatus = await page.request.get("/api/night")
      expect(oldStatus.status()).toBe(409)
      expect(await oldStatus.json()).toMatchObject({ state: "failed", wrongExam: "agentic-architect", error: /Reload Night reading/ })
      expect((await page.request.get(`/api/night/audio/${second.key}`)).status()).toBe(409)
      await expect(page.getByRole("button", { name: "Play", exact: true })).toHaveCount(0)
      // An unnamed entry belongs to the default exam, so storing this exam's recording keeps it.
      await page.evaluate(async (stale) => {
        const cache = await caches.open("quiz-night")
        await cache.put(`/api/night/audio/${stale}`, new Response("old", { headers: { "Content-Type": "audio/mp4" } }))
      }, staleKey)
      await page.getByRole("button", { name: /^Store on this device/ }).click()
      await expect(page.getByRole("button", { name: "Play", exact: true })).toBeVisible()
      await readyOffline(page)
      expect(await page.evaluate(async (stale) => {
        const cache = await caches.open("quiz-night")
        return !!await cache.match(`/api/night/audio/${stale}`)
      }, staleKey)).toBe(true)
      await context.setOffline(true)
      await page.reload()
      await page.getByRole("button", { name: "Play", exact: true }).click()
      await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeVisible()
      await expect(page.getByRole("status").filter({ hasText: "Understand Google Cloud Agents" })).toBeVisible()

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

  test("a Rise reading opens, saves progress and reopens offline", async ({ context, page, baseURL }) => {
    const origin = { origin: baseURL! }
    try {
      expect((await page.request.post("/api/exam", { headers: origin, data: { exam: "rise-test" } })).ok()).toBe(true)
      expect((await page.request.post("/api/scores/reset", {
        headers: { ...origin, "x-quiz-exam": "rise-test" }, data: { confirm: true },
      })).ok()).toBe(true)
      await page.goto("/progress")
      await readyOffline(page)
      await page.goto("/read/1")
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
      const snapshot = await page.request.get("/api/snapshot", { headers: { "x-quiz-exam": "rise-test" } })
      expect(await snapshot.json()).toMatchObject({
        ok: true, snapshot: { lines: expect.arrayContaining([expect.objectContaining({ mode: "reading", asked: ["1/000000000000000000000001"] })]) },
      })
      await page.getByRole("link", { name: /Test Rise reading two/ }).first().click()
      await expect(page.locator("main")).toContainText("This is the second synthetic Rise reading.")
      await context.setOffline(true)
      const reopened = await page.goto("/read/1/000000000000000000000001")
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
    // No sentence ends by itself: the test decides when each one does, so it pauses at an exact moment on any browser.
    await context.addInitScript(voiceStub, { voices: true, hold: true })
    await page.goto("/progress")
    await readyOffline(page)
    // The exam's own pages are in the worker's list; wait for it to hold the study pages before going offline.
    await expect.poll(() => page.evaluate(async () => (await caches.keys()).length > 0)).toBe(true)
    await expect.poll(() => page.evaluate(async () => {
      const pageUrl = new URL("/read/8/98001", location.origin)
      return Boolean(await caches.match(pageUrl))
    })).toBe(true)
    await page.waitForLoadState("networkidle")
    await context.setOffline(true)
    const privateReading = await page.goto("/read/8/98001")
    expect(privateReading?.status()).toBe(200)
    const privateText = ["Synthetic private fixture", "used only by the offline browser test."].join(" ")
    await expect(page.locator("main")).toContainText(privateText)
    await expect(page.getByRole("button", { name: "Play", exact: true })).toBeVisible()
    // The Mac's speech route is aborted, so a pass cannot come from a mocked network answer.
    // The device voice is a silent stub that records what it is asked to say and ends each sentence itself.
    await page.route(/\/api\/speak(?:\/|$|\?)/, (route) => route.abort())
    await page.getByRole("button", { name: "Play", exact: true }).click()
    await expect(page.getByText("The Mac is unreachable. Reading with this device's local voice; the text stays on this device.")).toBeVisible()
    // Let sentences end one by one until the fixture's own sentence is being said; it is then held.
    await expect.poll(async () => {
      const said = (await spokenNow(page)).includes(privateText)
      if (!said) await releaseNow(page)
      return said
    }, { timeout: 20_000 }).toBe(true)
    const spoken = await spokenNow(page)
    expect(spoken.every((text) => typeof text === "string" && text.length > 0)).toBe(true)
    // Pause stops the voice; Play carries on and says the same sentence again.
    const count = spoken.length
    const paused = spoken[count - 1]
    expect(paused).toBe(privateText)
    const cancelledBefore = await cancelledNow(page)
    await page.getByRole("button", { name: "Pause", exact: true }).click({ timeout: 10_000 })
    expect(await cancelledNow(page), "Pause cancelled the device voice").toBeGreaterThan(cancelledBefore)
    await page.getByRole("button", { name: "Play", exact: true }).click()
    await expect.poll(async () => (await spokenNow(page))[count]).toBe(paused)
    // Let it finish: the resumed sentence is the one being held now.
    await releaseNow(page)
    // The reading finishes on the device and is queued as read, with no request to the Mac.
    await expect(page.getByRole("button", { name: "✓ MARKED AS READ TODAY" })).toBeVisible()
    for (const path of ["/", "/exam", "/practice", "/flashcards", "/glossary", "/study", "/study/low-code", "/study/low-code/1-1", "/progress", "/read", "/about"]) {
      const response = await page.goto(path)
      expect(response?.status(), path).toBe(200)
      await expect(page.locator("h1")).not.toBeEmpty()
    }
    await page.goto("/practice")
    await page.getByRole("button", { name: /^A\./ }).click()
    const queue = () => page.evaluate(() => JSON.parse(localStorage.getItem("quiz-outbox-agentic-architect") ?? "[]").length)
    // The finished private reading and the practice answer are both waiting in this exam's outbox.
    await expect.poll(queue).toBe(2)
    const queued: { id: string; mode: string }[] = await page.evaluate(() => JSON.parse(localStorage.getItem("quiz-outbox-agentic-architect") ?? "[]"))
    expect(queued.map((line) => line.mode).sort()).toEqual(["practice", "reading"])
    await context.setOffline(false)
    await expect.poll(queue).toBe(0)
    const response = await page.request.get("/api/snapshot", { headers: { "x-quiz-exam": "agentic-architect" } })
    expect(await response.json()).toMatchObject({ ok: true, snapshot: { lines: expect.arrayContaining(queued.map((line) => expect.objectContaining({ id: line.id, mode: line.mode }))) } })
    // The first exam's queue was never touched.
    expect(await page.evaluate(() => localStorage.getItem("quiz-outbox-generative-ai-leader"))).toBeNull()
  } finally {
    await context.setOffline(false)
    await page.request.post("/api/exam", { headers: origin, data: { exam: "generative-ai-leader" } })
  }
})

// The Mac cannot make a clip while the browser still believes it is online (the Mac is off, or answers an error). The
// failed request is expected here, so the fixture is told to ignore failed API calls.
test.describe("reading aloud when the Mac cannot answer", () => {
  test.use({ offlineNetwork: true, navigationCutOff: true })
  const first = ["First synthetic", "paragraph."].join(" ")
  const second = ["Second synthetic", "paragraph."].join(" ")

  // Let the offline worker finish installing before anything else: switching the exam back under an install stalls it.
  async function openReading(page: Page) {
    await page.goto("/read/8/98002")
    await readyOffline(page)
    await page.waitForLoadState("networkidle")
  }

  test.beforeEach(async ({ page, baseURL }) => {
    expect((await page.request.post("/api/exam", { headers: { origin: baseURL! }, data: { exam: "agentic-architect" } })).ok()).toBe(true)
  })
  test.afterEach(async ({ page, baseURL }) => {
    await page.request.post("/api/exam", { headers: { origin: baseURL! }, data: { exam: "generative-ai-leader" } })
    await page.goto("/progress")
    await readyOffline(page)
    await page.waitForLoadState("networkidle")
  })

  test("an error from the Mac switches to the device voice and says what the Mac answered", async ({ context, page }) => {
    await context.addInitScript(voiceStub, { voices: true })
    // The note below is the proof that the Mac answered 500; WebKit does not route a request its worker handles, so the
    // test server's own refusal (it never makes speech in tests) is the 500 there.
    await page.route(/\/api\/speak\/reading$/, (route) => route.fulfill({ status: 500, contentType: "application/json", body: "{}" }))
    await openReading(page)
    await page.getByRole("button", { name: "Play", exact: true }).click()
    await expect(page.getByText("The Mac could not make this voice (the Mac answered 500). Reading with this device's local voice; the text stays on this device.")).toBeVisible()
    await expect.poll(() => spokenNow(page)).toContain(first)
    // After the first failure the next paragraph goes straight to the device voice.
    await expect.poll(() => spokenNow(page), { timeout: 15_000 }).toContain(second)
  })

  test("with no device voice and no Mac the page says so and stays silent", async ({ context, page }) => {
    await context.addInitScript(voiceStub, { voices: false })
    await page.route(/\/api\/speak\/reading$/, (route) => route.abort())
    await openReading(page)
    await page.getByRole("button", { name: "Play", exact: true }).click()
    await expect(page.locator("p[role=alert]")).toContainText("No local English voice is available on this device either. Install a device voice to read aloud without the Mac.", { timeout: 10_000 })
    expect(await spokenNow(page)).toEqual([])
    await expect(page.getByRole("button", { name: "Play", exact: true })).toBeVisible()
  })

  test("the device voice goes on to the next paragraph", async ({ context, page }) => {
    await context.addInitScript(voiceStub, { voices: true })
    await page.route(/\/api\/speak\/reading$/, (route) => route.abort())
    await openReading(page)
    await page.getByRole("button", { name: "Play", exact: true }).click()
    await expect.poll(async () => {
      const spoken = await spokenNow(page)
      return spoken.indexOf(first) >= 0 && spoken.indexOf(second) > spoken.indexOf(first)
    }, { timeout: 15_000 }).toBe(true)
  })

  test("leaving the page stops the device voice at once", async ({ context, page }) => {
    // The sentence is held while being said, so the voice is mid-sentence at the moment the person leaves.
    await context.addInitScript(voiceStub, { voices: true, hold: true })
    await page.route(/\/api\/speak\/reading$/, (route) => route.abort())
    await openReading(page)
    await page.getByRole("button", { name: "Play", exact: true }).click()
    await expect.poll(() => spokenNow(page)).toContain(first)
    const cancelledBefore = await cancelledNow(page)
    // The app's own link keeps the page's window, so the stub's record shows what happens after leaving.
    await page.getByRole("link", { name: "COURSE 12" }).click()
    await expect(page).toHaveURL(/\/read\/12$/)
    expect(await cancelledNow(page), "leaving cancelled the device voice").toBeGreaterThan(cancelledBefore)
    // Ending the held sentence now, as the browser would if it had not been cancelled, must lead to nothing more being said.
    const spokenAtLeave = (await spokenNow(page)).length
    await releaseNow(page)
    await page.waitForTimeout(1500)
    expect((await spokenNow(page)).length).toBe(spokenAtLeave)
  })

  test("a failed look-ahead clip also sends the rest of the reading to the device voice", async ({ context, page }) => {
    // The first paragraph's clip from the Mac is good and plays. The clip asked for ahead of time, the second paragraph's, fails.
    // The second paragraph must then be said by the device voice without another request to the Mac: without the rule that a
    // failed look-ahead counts, the page would ask again (a third request) before giving up.
    await context.addInitScript(voiceStub, { voices: true, clips: "ok-then-fail" as const, audioEnds: true })
    await openReading(page)
    await page.getByRole("button", { name: "Play", exact: true }).click()
    await expect.poll(() => spokenNow(page), { timeout: 20_000 }).toEqual([second])
    expect(await clipRequests(page), "the good clip, the failed look-ahead, and none after that").toBe(2)
  })

  test("after one failure the rest of the reading skips the Mac, and a new Play asks it again", async ({ context, page }) => {
    await context.addInitScript(voiceStub, { voices: true, hold: true })
    await page.route(/\/api\/speak\/reading$/, (route) => route.fulfill({ status: 500, contentType: "application/json", body: "{}" }))
    await openReading(page)
    await page.getByRole("button", { name: "Play", exact: true }).click()
    // Let sentences end one by one until the first paragraph is being said, which is held.
    await expect.poll(async () => {
      const said = (await spokenNow(page)).includes(first)
      if (!said) await releaseNow(page)
      return said
    }, { timeout: 20_000 }).toBe(true)
    expect(await clipRequests(page), "one request failed, and the sentences after it did not ask the Mac").toBe(1)
    await page.getByRole("button", { name: "Pause", exact: true }).click({ timeout: 10_000 })
    await page.getByRole("button", { name: "Play", exact: true }).click()
    await expect.poll(() => clipRequests(page), { message: "a new Play asks the Mac again" }).toBe(2)
  })
})
