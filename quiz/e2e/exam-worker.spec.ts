import { createServer, request } from "node:http"
import type { Page } from "@playwright/test"
import { test, expect, readyOffline } from "./fixtures"

// A voice clip a page still fetches here answers 500, because browser tests never run `say`; this file is not about voice.
test.use({ navigationCutOff: true, expectedWrongExam: true, voiceClipRefusal: true })

const LEGACY_WORKER = `
self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open("quiz-legacy-worker-test")
    await cache.put("/", await fetch("/", { cache: "no-store" }))
    await self.skipWaiting()
  })())
})
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()))
self.addEventListener("fetch", (event) => {
  if (event.request.mode === "navigate" && new URL(event.request.url).pathname === "/") {
    event.respondWith(caches.open("quiz-legacy-worker-test").then((cache) => cache.match("/")))
  }
})
`

async function workerProxy(baseURL: string) {
  let legacy = true
  const base = new URL(baseURL)
  const server = createServer((incoming, outgoing) => {
    // Only a path on the app under test is forwarded: the host, port and protocol come from baseURL alone.
    const target = incoming.url ?? "/"
    if (!target.startsWith("/") || target.startsWith("//")) {
      outgoing.writeHead(400)
      outgoing.end()
      return
    }
    if (legacy && new URL(target, base).pathname === "/sw.js") {
      outgoing.writeHead(200, { "Content-Type": "application/javascript", "Cache-Control": "no-store" })
      outgoing.end(LEGACY_WORKER)
      return
    }
    const upstream = request({
      protocol: base.protocol,
      hostname: base.hostname,
      port: base.port,
      path: target,
      method: incoming.method,
      headers: incoming.headers,
    }, (response) => {
      outgoing.writeHead(response.statusCode ?? 502, response.headers)
      response.pipe(outgoing)
    })
    upstream.on("error", (error) => outgoing.destroy(error))
    incoming.pipe(upstream)
  })
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject)
    server.listen(0, "localhost", resolve)
  })
  const address = server.address()
  if (!address || typeof address === "string") throw new Error("The worker test proxy did not get a port")
  return {
    origin: `http://localhost:${address.port}`,
    upgrade: () => { legacy = false },
    close: async () => {
      const closed = new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
      server.closeAllConnections()
      await closed
    },
  }
}

async function blockWorkerUpdate(page: Page) {
  await readyOffline(page)
  await expect.poll(() => page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration()
    return !!registration && !registration.installing && !registration.waiting
  }), { timeout: 60_000 }).toBe(true)
  await page.evaluate(() => {
    const container = navigator.serviceWorker
    const worker = container.controller
    if (!worker) throw new Error("The offline worker did not take control")
    Object.defineProperty(worker, "postMessage", { configurable: true, value: () => { throw new Error("The worker cannot receive this message") } })
    Object.defineProperty(container, "getRegistration", { configurable: true, value: async () => undefined })
  })
}

async function allowWorkerUpdate(page: Page) {
  await page.evaluate(() => {
    const container = navigator.serviceWorker
    if (container.controller) Reflect.deleteProperty(container.controller, "postMessage")
    Reflect.deleteProperty(container, "getRegistration")
  })
}

// These journeys exercise page fetching, not storing the thousands of unrelated voice clips.
async function leaveVoiceDownloadsOut(page: Page) {
  await page.route("**/api/snapshot", async (route) => {
    const response = await route.fetch()
    if (!response.ok()) return route.fulfill({ response })
    const body = await response.json() as { snapshot: { voice: Record<string, string> } }
    body.snapshot.voice = {}
    await route.fulfill({ response, json: body })
  })
}

test("an older offline worker upgrades before the exam switch loads a page", async ({ context, page, baseURL }) => {
  test.setTimeout(180_000)
  const proxy = await workerProxy(baseURL!)
  try {
    await leaveVoiceDownloadsOut(page)
    await page.goto(`${proxy.origin}/progress`)
    await readyOffline(page)
    expect(await page.evaluate(async () => {
      const cache = await caches.open("quiz-legacy-worker-test")
      const response = await cache.match("/")
      return (await response?.text())?.includes('data-exam="generative-ai-leader"')
    })).toBe(true)
    proxy.upgrade()
    await page.getByLabel("Exam", { exact: true }).selectOption("agentic-architect")
    await page.getByRole("button", { name: "Switch exam", exact: true }).click()
    await expect(page.locator("html")).toHaveAttribute("data-exam", "agentic-architect", { timeout: 60_000 })
    await expect(page.getByText("PROFESSIONAL AGENTIC ARCHITECT")).toBeVisible()
  } finally {
    await context.request.post(`${baseURL}/api/exam`, { headers: { origin: baseURL! }, data: { exam: "generative-ai-leader" } })
    if (!page.isClosed() && page.url().startsWith(proxy.origin)) {
      await page.evaluate(async () => {
        await Promise.all((await navigator.serviceWorker.getRegistrations()).map((registration) => registration.unregister()))
      })
      await page.close()
    }
    await proxy.close()
  }
})

test("a switch reports an unavailable worker and lets the device retry without reopening the old exam", async ({ page, baseURL }) => {
  test.setTimeout(120_000)
  try {
    await leaveVoiceDownloadsOut(page)
    await page.goto("/progress")
    await blockWorkerUpdate(page)
    await page.getByLabel("Exam", { exact: true }).selectOption("agentic-architect")
    await page.getByRole("button", { name: "Switch exam", exact: true }).click()
    await expect(page.getByRole("alert").filter({ hasText: "could not update its offline worker" })).toBeVisible()
    await expect(page.locator("html")).toHaveAttribute("data-exam", "generative-ai-leader")
    expect((await page.request.get("/api/snapshot", { headers: { "x-quiz-exam": "agentic-architect" } })).status()).toBe(200)
    await allowWorkerUpdate(page)
    await page.getByRole("button", { name: "Try loading again", exact: true }).click()
    await expect(page.locator("html")).toHaveAttribute("data-exam", "agentic-architect", { timeout: 30_000 })
  } finally {
    await page.request.post("/api/exam", { headers: { origin: baseURL! }, data: { exam: "generative-ai-leader" } })
  }
})

test("another device reports an unavailable worker and can retry its wrong-exam reload", async ({ page, baseURL }) => {
  test.setTimeout(120_000)
  try {
    await leaveVoiceDownloadsOut(page)
    await page.goto("/progress")
    await blockWorkerUpdate(page)
    expect((await page.request.post("/api/exam", { headers: { origin: baseURL! }, data: { exam: "agentic-architect" } })).ok()).toBe(true)
    const refused = page.waitForResponse((response) =>
      new URL(response.url()).pathname === "/api/snapshot" && response.status() === 409,
    )
    await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")))
    expect((await refused).status()).toBe(409)
    const notice = page.getByRole("complementary", { name: "EXAM CHANGED" })
    await expect(notice.getByRole("alert")).toContainText("The Mac now serves another exam")
    await expect(page.locator("html")).toHaveAttribute("data-exam", "generative-ai-leader")
    await notice.getByRole("button", { name: "Try loading again", exact: true }).click()
    await expect(notice.getByRole("alert")).toContainText("It still could not load it", { timeout: 60_000 })
    await allowWorkerUpdate(page)
    await notice.getByRole("button", { name: "Try loading again", exact: true }).click()
    await expect(page.locator("html")).toHaveAttribute("data-exam", "agentic-architect", { timeout: 30_000 })
  } finally {
    await page.request.post("/api/exam", { headers: { origin: baseURL! }, data: { exam: "generative-ai-leader" } })
  }
})

test("the test proxy refuses a request target that is not a path on the app under test", async ({ page, baseURL }) => {
  // The shared clean-up unregisters service workers, which needs a page of the app.
  await page.goto("/progress")
  const proxy = await workerProxy(baseURL!)
  const { port } = new URL(proxy.origin)
  const statusOf = (target: string) => new Promise<number>((resolve, reject) => {
    const probe = request({ hostname: "localhost", port, path: target, method: "GET" }, (response) => {
      response.resume()
      resolve(response.statusCode ?? 0)
    })
    probe.on("error", reject)
    probe.end()
  })
  try {
    // Another host by protocol-relative name, and another host by full address, are refused and never forwarded.
    expect(await statusOf("//evil.example/steal")).toBe(400)
    expect(await statusOf("http://evil.example/steal")).toBe(400)
    // A path on the app under test still goes through.
    expect(await statusOf("/")).toBe(200)
  } finally {
    await proxy.close()
  }
})
