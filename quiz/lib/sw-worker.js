/* The quiz's service worker. app/sw.js/route.ts serves this file with CONFIG defined above it:
 * { build, pages, statics }. Plain JavaScript, so the route serves it as it is and a test can run it. */
/* global CONFIG */
const PAGE_CACHE = `quiz-pages-${CONFIG.build}`
const STATIC_CACHE = `quiz-static-${CONFIG.build}`
// Kept across builds: the Mac's voice for every line the quiz can say, and Night reading's recording.
const VOICE_CACHE = "quiz-voice"
const NIGHT_CACHE = "quiz-night"
// How long a page waits for the Mac before it opens from the device.
const TIMEOUT_MS = 2500
// After one failure, pages open from the device without asking the Mac for this long.
const SKIP_MS = 30000
let downUntil = 0
let connectionGeneration = 0

const statics = new Set(CONFIG.statics)

function pageKey(url) {
  const parsed = new URL(url)
  parsed.searchParams.delete("_rsc")
  return parsed.pathname + parsed.search
}

async function fromMac(request) {
  if (Date.now() < downUntil) throw new Error("the Mac was not reachable a moment ago")
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  const generation = connectionGeneration
  try {
    // A navigation request cannot be copied with new options, so pages are fetched by URL.
    const response = request.mode === "navigate"
      ? await fetch(request.url, { signal: controller.signal, credentials: "same-origin" })
      : await fetch(request, { signal: controller.signal })
    if (response.status >= 500) throw new Error(`the Mac answered ${response.status}`)
    return response
  } catch (error) {
    if (generation === connectionGeneration) downUntil = Date.now() + SKIP_MS
    throw error
  } finally {
    clearTimeout(timer)
  }
}

async function page(request) {
  const cache = await caches.open(PAGE_CACHE)
  const key = pageKey(request.url)
  try {
    const response = await fromMac(request)
    if (response.ok && !response.redirected) await cache.put(key, response.clone())
    return response
  } catch {
    const kept = (await cache.match(key)) || (await cache.match(new URL(request.url).pathname))
    return kept || new Response("The Mac cannot be reached, and this page is not on this device yet.", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } })
  }
}

// Next.js's data for a client-side navigation. Kept by its full URL: the _rsc value is a hash of
// the request's router headers, so the same URL always asks for the same data. Offline, a kept
// copy lets the app change page without reloading, which keeps the tap that allows the voice to
// play. With no copy it answers 503, and Next.js loads the page in full, which page() serves.
async function flight(request) {
  const cache = await caches.open(PAGE_CACHE)
  try {
    const response = await fromMac(request)
    if (response.ok && !response.redirected) await cache.put(request, response.clone())
    return response
  } catch {
    return (await cache.match(request)) || new Response("", { status: 503 })
  }
}

async function cacheFirst(request, name) {
  const cache = await caches.open(name)
  const kept = await cache.match(request)
  if (kept) return kept
  const response = await fetch(request)
  if (response.ok) await cache.put(request, response.clone())
  return response
}

async function precache(name, urls) {
  const cache = await caches.open(name)
  // One page that fails to load does not stop the rest.
  await Promise.allSettled(urls.map(async (url) => {
    const response = await fetch(url, { cache: "reload", credentials: "same-origin" })
    if (response.ok && !response.redirected) await cache.put(url, response)
  }))
}

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    await precache(STATIC_CACHE, CONFIG.statics)
    await precache(PAGE_CACHE, CONFIG.pages)
    await self.skipWaiting()
  })())
})

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if (name !== PAGE_CACHE && name !== STATIC_CACHE && name !== VOICE_CACHE && name !== NIGHT_CACHE) await caches.delete(name)
    }
    await self.clients.claim()
  })())
})

self.addEventListener("message", (event) => {
  if (event.data !== "quiz-mac-reachable") return
  downUntil = 0
  connectionGeneration += 1
  event.ports[0]?.postMessage("ready")
  event.ports[0]?.close()
})

self.addEventListener("fetch", (event) => {
  const request = event.request
  if (request.method !== "GET") return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  // The page reads stored voice clips itself, and icons go straight to the Mac: on the iPhone,
  // as a home-screen app, voice and the icon both failed when this worker answered them.
  if (url.pathname.startsWith("/api/")) return
  if (/^\/(apple-touch-icon|favicon)/.test(url.pathname)) return
  if (url.pathname.startsWith("/_next/static/") || statics.has(url.pathname)) return event.respondWith(cacheFirst(request, STATIC_CACHE))
  if (request.mode === "navigate") return event.respondWith(page(request))
  if (request.headers.get("RSC") === "1" || url.searchParams.has("_rsc")) return event.respondWith(flight(request))
})
