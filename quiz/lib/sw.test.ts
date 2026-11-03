import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import vm from "node:vm"
import { coursePages, NIGHT_CACHE, pageList, readingPages, staticList, workerScript } from "./sw.ts"

const ORIGIN = "https://localhost"
const worker = readFileSync(new URL("./sw-worker.js", import.meta.url), "utf8")
const config = { build: "b2", pages: ["/", "/voice", "/practice?section=2"], statics: ["/_next/static/app.js", "/logo.png"] }

type Handler = (event: unknown) => void
type Net = (url: string) => Response | Promise<Response>

// Runs sw-worker.js in its own context, with a fake Cache Storage and a fake network.
function load(net: Net) {
  const handlers: Record<string, Handler> = {}
  const stores = new Map<string, Map<string, Response>>()
  const key = (item: string | { url: string }) => new URL(typeof item === "string" ? item : item.url, ORIGIN).href
  const store = (name: string) => {
    if (!stores.has(name)) stores.set(name, new Map())
    return stores.get(name)!
  }
  const calls: string[] = []
  const context = vm.createContext({
    self: { addEventListener: (type: string, fn: Handler) => (handlers[type] = fn), location: { origin: ORIGIN }, skipWaiting: async () => undefined, clients: { claim: async () => undefined } },
    caches: {
      open: async (name: string) => ({
        match: async (item: string | { url: string }) => store(name).get(key(item))?.clone(),
        put: async (item: string | { url: string }, response: Response) => void store(name).set(key(item), response),
      }),
      keys: async () => [...stores.keys()],
      delete: async (name: string) => stores.delete(name),
    },
    fetch: async (item: string | { url: string }) => {
      calls.push(key(item))
      return net(key(item))
    },
    URL,
    Response,
    AbortController,
    setTimeout,
    clearTimeout,
  })
  vm.runInContext(workerScript(config, worker), context)
  const lifecycle = async (type: string) => {
    let done: Promise<unknown> = Promise.resolve()
    handlers[type]?.({ waitUntil: (promise: Promise<unknown>) => (done = promise) })
    await done
  }
  const request = async (path: string, init: { method?: string; mode?: string; headers?: Record<string, string> } = {}) => {
    let answer: Promise<Response> | null = null
    const event = { request: { url: new URL(path, ORIGIN).href, method: init.method ?? "GET", mode: init.mode ?? "cors", headers: new Headers(init.headers ?? {}) }, respondWith: (promise: Promise<Response>) => (answer = promise) }
    handlers.fetch?.(event)
    return answer === null ? null : await (answer as Promise<Response>)
  }
  return { stores, store, calls, lifecycle, request }
}

const ok = (body: string) => new Response(body, { status: 200 })
const offline = () => {
  throw new TypeError("Load failed")
}

test("installing stores every page and static file, even when one fails", async () => {
  const sw = load((url) => (url.endsWith("/voice") ? offline() : ok(url)))
  await sw.lifecycle("install")
  assert.deepEqual([...sw.store("quiz-pages-b2").keys()], [`${ORIGIN}/`, `${ORIGIN}/practice?section=2`])
  assert.deepEqual([...sw.store("quiz-static-b2").keys()], [`${ORIGIN}/_next/static/app.js`, `${ORIGIN}/logo.png`])
})

test("a page comes from the Mac when it answers, and is kept for later", async () => {
  const sw = load(() => ok("fresh"))
  const response = await sw.request("/voice", { mode: "navigate" })
  assert.equal(await response?.text(), "fresh")
  assert.equal(await sw.store("quiz-pages-b2").get(`${ORIGIN}/voice`)?.text(), "fresh")
})

test("with no connection a page opens from the device, and the Mac is skipped for a while", async () => {
  const sw = load(offline)
  sw.store("quiz-pages-b2").set(`${ORIGIN}/voice`, ok("kept"))
  assert.equal(await (await sw.request("/voice", { mode: "navigate" }))?.text(), "kept")
  assert.equal(await (await sw.request("/voice", { mode: "navigate" }))?.text(), "kept")
  assert.equal(sw.calls.length, 1, "the second visit does not wait for the Mac again")
  const missing = await sw.request("/glossary", { mode: "navigate" })
  assert.equal(missing?.status, 503)
})

test("a Mac error is treated like no connection", async () => {
  const sw = load(() => new Response("boom", { status: 502 }))
  sw.store("quiz-pages-b2").set(`${ORIGIN}/`, ok("kept"))
  assert.equal(await (await sw.request("/", { mode: "navigate" }))?.text(), "kept")
})

test("a failed client-side navigation answers 503, so Next.js loads the page in full", async () => {
  const sw = load(offline)
  const response = await sw.request("/progress?_rsc=abc", { headers: { RSC: "1" } })
  assert.equal(response?.status, 503)
})

test("offline, a navigation the app made online is answered from the device, with no reload", async () => {
  let online = true
  const sw = load(() => (online ? ok("flight data") : offline()))
  assert.equal(await (await sw.request("/voice?_rsc=x1", { headers: { RSC: "1" } }))?.text(), "flight data")
  online = false
  assert.equal(await (await sw.request("/voice?_rsc=x1", { headers: { RSC: "1" } }))?.text(), "flight data")
  assert.equal((await sw.request("/voice?_rsc=other", { headers: { RSC: "1" } }))?.status, 503, "another hash is other data")
})

test("static files come from the device first; voice clips and icons are not the worker's", async () => {
  const sw = load(() => ok("network"))
  sw.store("quiz-static-b2").set(`${ORIGIN}/_next/static/app.js`, ok("kept"))
  assert.equal(await (await sw.request("/_next/static/app.js"))?.text(), "kept")
  assert.equal(await sw.request("/api/speak/abc"), null)
  assert.equal(await sw.request("/apple-touch-icon.png"), null)
  assert.equal(await sw.request("/favicon.png"), null)
  assert.deepEqual(sw.calls, [])
})

test("scores, the snapshot and other sites are never answered from the device", async () => {
  const sw = load(() => ok("network"))
  assert.equal(await sw.request("/api/scores", { method: "POST" }), null)
  assert.equal(await sw.request("/api/snapshot"), null)
  assert.equal(await sw.request("https://example.com/x.js"), null)
})

test("a new build drops the old build's caches and keeps the voice and the night recording", async () => {
  const sw = load(() => ok(""))
  for (const name of ["quiz-pages-b1", "quiz-static-b1", "quiz-pages-b2", "quiz-voice", NIGHT_CACHE]) sw.store(name)
  await sw.lifecycle("activate")
  assert.match(worker, new RegExp(NIGHT_CACHE))
  assert.deepEqual([...sw.stores.keys()].sort(), ["quiz-night", "quiz-pages-b2", "quiz-voice"])
})

test("Read Aloud's pages are stored too: the overview, each course and every reading Google sent", () => {
  const pages = readingPages([
    { id: "1", pages: [{ id: "aaa" }, { id: "bbb" }] },
    { id: "2", pages: null },
  ])
  assert.deepEqual(pages, ["/read", "/read/1", "/read/1/aaa", "/read/1/bbb", "/read/2"])
  assert.deepEqual(readingPages([{ id: "1", pages: [{ id: "a b/c" }] }]), ["/read", "/read/1", "/read/1/a%20b%2Fc"])
})

test("a course late to answer reuses the readings it last sent, so the worker stays the same", async () => {
  const courses = [{ id: "1" }, { id: "2" }]
  const never = new Promise<never>(() => {})
  const last = new Map<string, { id: string }[]>()
  const fast = async () => ({ ok: true as const, pages: [{ id: "a" }] })
  const now = Promise.resolve(null)
  // First call: course 1 answers, course 2 never does and was never loaded, so it sends null.
  const first = await coursePages(courses, (course) => (course.id === "1" ? fast() : never), new Promise((resolve) => setTimeout(() => resolve(null), 10)), last)
  assert.deepEqual(first, [{ id: "1", pages: [{ id: "a" }] }, { id: "2", pages: null }])
  // Second call: both late (or failed); course 1 keeps what it sent before.
  assert.deepEqual(await coursePages(courses, () => never, now, last), first)
  assert.deepEqual(await coursePages(courses, async () => ({ ok: false as const }), now, last), first)
})

test("the page list covers every page, section, topic and Practice filter", () => {
  const pages = pageList([{ id: "fundamentals", topics: [{ id: "ml basics" }] }], ["1", "2"], { reading: true, exam: { questions: 60, minutes: 90 } })
  for (const page of ["/", "/voice", "/read", "/read/night", "/progress", "/study/fundamentals", "/study/fundamentals/ml%20basics", "/practice?topic=ml%20basics", "/practice?section=2", "/practice?unanswered=1", "/practice?section=2&unanswered=1", "/practice?topic=ml%20basics&unanswered=1"]) {
    assert.ok(pages.includes(page), page)
  }
  assert.deepEqual(staticList(["chunks/a b.js"], "/_next/static"), ["/_next/static/chunks/a%20b.js"])
})

test("two exams that number their courses from 1 never share a course's remembered readings", async () => {
  const last = new Map<string, { id: string }[]>()
  const never = new Promise<null>(() => undefined)
  const first = { id: "1", template: "1268" }
  const other = { id: "1", template: "1584" }
  await coursePages([first], async () => ({ ok: true as const, pages: [{ id: "gen-ai-page" }] }), never, last)
  // The other exam's course 1 fails to load: it must not borrow the first exam's pages.
  const result = await coursePages([other], async () => ({ ok: false as const }), Promise.resolve(null), last)
  assert.deepEqual(result, [{ id: "1", pages: null }])
})
