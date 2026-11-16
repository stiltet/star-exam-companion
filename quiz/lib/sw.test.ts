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
function load(net: Net, timer: typeof setTimeout = setTimeout) {
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
    setTimeout: timer,
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
  const message = (data: string) => {
    let reply: string | null = null
    handlers.message?.({ data, ports: [{ postMessage: (value: string) => { reply = value }, close: () => {} }] })
    return reply
  }
  return { stores, store, calls, lifecycle, request, message }
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

test("a confirmed Mac response clears the offline backoff before the next page load", async () => {
  let online = false
  const sw = load(() => online ? ok("current exam") : offline())
  sw.store("quiz-pages-b2").set(`${ORIGIN}/`, ok("previous exam"))
  assert.equal(await (await sw.request("/", { mode: "navigate" }))?.text(), "previous exam")
  online = true
  assert.equal(sw.message("unrelated"), null)
  assert.equal(await (await sw.request("/", { mode: "navigate" }))?.text(), "previous exam")
  assert.equal(sw.message("quiz-mac-reachable"), "ready")
  assert.equal(await (await sw.request("/", { mode: "navigate" }))?.text(), "current exam")
  assert.equal(sw.calls.length, 2)
})

test("an older failed request cannot restore backoff after the Mac responds", async () => {
  let started: () => void = () => {}
  let fail: (error: Error) => void = () => {}
  const waiting = new Promise<Response>((_resolve, reject) => { fail = reject })
  const began = new Promise<void>((resolve) => { started = resolve })
  let first = true
  const sw = load(() => {
    if (!first) return ok("current exam")
    first = false
    started()
    return waiting
  })
  sw.store("quiz-pages-b2").set(`${ORIGIN}/`, ok("previous exam"))
  const older = sw.request("/", { mode: "navigate" })
  await began
  assert.equal(sw.message("quiz-mac-reachable"), "ready")
  fail(new TypeError("Earlier request failed"))
  assert.equal(await (await older)?.text(), "previous exam")
  assert.equal(await (await sw.request("/", { mode: "navigate" }))?.text(), "current exam")
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

test("a page that is not on the device waits for a slow Mac instead of giving up", async () => {
  const sw = load(async (url) => {
    await new Promise((resolve) => setTimeout(resolve, 2700))
    return ok("slow page")
  })
  const slow = await sw.request("/slow-test", { mode: "navigate" })
  assert.equal(slow?.status, 200, "slower than 2.5 s, still answered by the Mac")
  assert.equal(await slow?.text(), "slow page")
})

test("a page that is neither reachable nor on the device shows a page with Try again and Go home, never plain text", async () => {
  const sw = load(offline)
  const response = await sw.request("/glossary", { mode: "navigate" })
  assert.equal(response?.status, 503)
  assert.match(response?.headers.get("Content-Type") ?? "", /text\/html/)
  const body = (await response?.text()) ?? ""
  assert.match(body, /TRY AGAIN/)
  assert.match(body, /href="\/"/)
})

test("with the Mac unreachable, a client-side navigation with no kept copy fails at once after the first miss, so the page opens without a second wait", async () => {
  const sw = load(offline)
  assert.equal((await sw.request("/?_rsc=a", { headers: { RSC: "1" } }))?.status, 503)
  const before = sw.calls.length
  assert.equal((await sw.request("/?_rsc=b", { headers: { RSC: "1" } }))?.status, 503)
  assert.equal(sw.calls.length, before, "the Mac is not asked again for a while")
})

test("a client-side navigation to a slow page that is not on the device is waited for, so a slow page is never cut off", async () => {
  const sw = load(async () => {
    await new Promise((resolve) => setTimeout(resolve, 2700))
    return ok("flight")
  })
  const response = await sw.request("/slow-test?_rsc=a", { headers: { RSC: "1" } })
  assert.equal(response?.status, 200)
})

test("an unreachable Mac costs one wait: after a failed client-side move the full page load skips the Mac, and Try again clears that", async () => {
  let up = false
  const sw = load(() => (up ? ok("the page") : offline()))
  assert.equal((await sw.request("/not-kept?_rsc=a", { headers: { RSC: "1" } }))?.status, 503)
  const asked = sw.calls.length
  const full = await sw.request("/not-kept", { mode: "navigate" })
  assert.equal(full?.status, 503)
  assert.match(await full!.text(), /TRY AGAIN/)
  assert.equal(sw.calls.length, asked, "the Mac is not asked a second time while it is known to be down")
  // Try again tells the worker to forget the backoff, and the page then loads once the Mac is back.
  up = true
  assert.equal(sw.message("quiz-mac-reachable"), "ready")
  const again = await sw.request("/not-kept", { mode: "navigate" })
  assert.equal(again?.status, 200)
  assert.equal(await again?.text(), "the page")
})

test("a page with no copy on the device waits up to 30 seconds for the Mac, and one with a copy only 2.5", async () => {
  const delays: number[] = []
  const timer = ((fn: () => void, ms: number) => { delays.push(ms); return setTimeout(fn, ms) }) as typeof setTimeout
  const sw = load(() => ok("fresh"), timer)
  sw.store("quiz-pages-b2").set(`${ORIGIN}/kept`, ok("kept"))
  await sw.request("/not-kept", { mode: "navigate" })
  await sw.request("/kept", { mode: "navigate" })
  assert.deepEqual(delays, [30000, 2500])
})

test("a request that was already on its way when another failed clears the backoff when the Mac answers it", async () => {
  let answer: () => void = () => {}
  const late = new Promise<void>((resolve) => { answer = resolve })
  const sw = load(async (url) => {
    if (url.endsWith("/late")) { await late; return ok("late") }
    return offline()
  })
  const pending = sw.request("/late", { mode: "navigate" })
  assert.equal((await sw.request("/fails", { mode: "navigate" }))?.status, 503)
  const asked = sw.calls.length
  assert.equal((await sw.request("/skipped", { mode: "navigate" }))?.status, 503)
  assert.equal(sw.calls.length, asked, "the backoff holds while the Mac is thought down")
  answer()
  assert.equal(await (await pending)?.text(), "late")
  await sw.request("/after", { mode: "navigate" })
  assert.equal(sw.calls.length, asked + 1, "the Mac answered, so it is asked again")
})

test("the unreachable page offers a saved page when Home is not saved, never a data request", async () => {
  const body = (await (await load(offline).request("/x", { mode: "navigate" }))!.text())
  const start = body.indexOf("<script>") + "<script>".length
  const end = body.lastIndexOf("</script>")
  assert.ok(start >= "<script>".length && end > start, "the page holds its inline script")
  const script = body.slice(start, end)
  const home = { href: "/", textContent: "GO HOME" }
  const again: { disabled: boolean; textContent: string; busy: string; onclick?: () => Promise<void>; setAttribute: (name: string, value: string) => void } = { disabled: false, textContent: "TRY AGAIN", busy: "", setAttribute: (_name, value) => { again.busy = value } }
  let reloaded = false
  const posted: string[] = []
  const channel = { port1: {} as { onmessage?: () => void }, port2: {} }
  const keys = [`${ORIGIN}/x`, `${ORIGIN}/practice?_rsc=abc`, `${ORIGIN}/voice?section=2`]
  vm.runInContext(script, vm.createContext({
    document: { getElementById: (id: string) => (id === "home" ? home : again) },
    caches: { match: async () => undefined, keys: async () => ["quiz-pages-b2", "quiz-voice"], open: async () => ({ keys: async () => keys.map((url) => ({ url })) }) },
    location: { pathname: "/x", reload: () => { reloaded = true } },
    navigator: { serviceWorker: { controller: { postMessage: (message: string) => { posted.push(message); channel.port1.onmessage?.() } } } },
    MessageChannel: class { port1 = channel.port1; port2 = channel.port2 },
    URL,
    setTimeout,
  }))
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(home.textContent, "OPEN A SAVED PAGE")
  assert.equal(home.href, "/voice?section=2", "a different saved page, and not the data request of /practice")
  // Try again shows at once that it is working, so a long wait never looks like a tap that did nothing.
  await again.onclick!()
  assert.equal(again.disabled, true)
  assert.equal(again.busy, "true")
  assert.equal(again.textContent, "TRYING…")
  assert.equal(reloaded, true)
  assert.deepEqual(posted, ["quiz-mac-reachable"], "the button tells the worker to forget the backoff before it reloads")
})
