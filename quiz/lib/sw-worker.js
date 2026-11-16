/* The quiz's service worker. app/sw.js/route.ts serves this file with CONFIG defined above it:
 * { build, pages, statics }. Plain JavaScript, so the route serves it as it is and a test can run it. */
/* global CONFIG */
const PAGE_PREFIX = "quiz-pages-"
const PAGE_CACHE = `${PAGE_PREFIX}${CONFIG.build}`
// The message the unreachable page's Try again sends, to clear the backoff before it reloads.
const MAC_REACHABLE = "quiz-mac-reachable"
const STATIC_CACHE = `quiz-static-${CONFIG.build}`
// Kept across builds: the Mac's voice for every line the quiz can say, and Night reading's recording.
const VOICE_CACHE = "quiz-voice"
const NIGHT_CACHE = "quiz-night"
// How long a page waits for the Mac before it opens from the device. Only when a copy is on the
// device: with none, the page is waited for much longer (30 s), because a slow Mac is not an unreachable one.
const TIMEOUT_MS = 2500
const NO_COPY_TIMEOUT_MS = 30000
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

// hasCopy: a copy is on the device to open instead, so the Mac is given only 2.5 s. A recent failure means
// the Mac is not asked at all for a while, for every request, so an unreachable Mac costs one wait, not two
// (a failed client-side move and the full page load Next.js then makes). Try again on the unreachable
// page clears that, and so does any answer from the Mac.
async function fromMac(request, hasCopy) {
  if (Date.now() < downUntil) throw new Error("the Mac was not reachable a moment ago")
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), hasCopy ? TIMEOUT_MS : NO_COPY_TIMEOUT_MS)
  const generation = connectionGeneration
  try {
    // A navigation request cannot be copied with new options, so pages are fetched by URL.
    const response = request.mode === "navigate"
      ? await fetch(request.url, { signal: controller.signal, credentials: "same-origin" })
      : await fetch(request, { signal: controller.signal })
    if (response.status >= 500) throw new Error(`the Mac answered ${response.status}`)
    // The Mac answered, so a backoff set a moment ago no longer holds.
    if (generation === connectionGeneration) downUntil = 0
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
  const kept = (await cache.match(key)) || (await cache.match(new URL(request.url).pathname))
  try {
    const response = await fromMac(request, Boolean(kept))
    if (response.ok && !response.redirected) await cache.put(key, response.clone())
    return response
  } catch {
    return kept || new Response(UNREACHABLE_PAGE, { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } })
  }
}

// Shown only when the Mac cannot be reached and the page was never opened on this device. It is
// never a dead end: it can try again (which first clears the backoff) and go Home, which is kept on the device, or to any saved page when Home is not.
const UNREACHABLE_PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Not on this device yet</title><style>body{font:18px/1.5 ui-monospace,Menlo,monospace;margin:0;padding:24px;background:#fff;color:#000}@media(prefers-color-scheme:dark){body{background:#0a0a0a;color:#fff}}a,button{display:block;box-sizing:border-box;width:100%;margin-top:16px;padding:14px;border:2px solid currentColor;background:none;color:inherit;font:inherit;font-weight:700;text-align:center;text-decoration:none}</style></head><body><p>The Mac cannot be reached, and this page is not on this device yet.</p><button id="again">TRY AGAIN</button><a id="home" href="/">GO HOME</a><script>const again=document.getElementById("again");again.onclick=async()=>{again.disabled=true;again.setAttribute("aria-busy","true");again.textContent="TRYING…";const c=navigator.serviceWorker&&navigator.serviceWorker.controller;if(c){const ch=new MessageChannel();c.postMessage("${MAC_REACHABLE}",[ch.port2]);await new Promise((done)=>{ch.port1.onmessage=()=>done();setTimeout(done,500)})}location.reload()};(async()=>{try{if(await caches.match("/"))return;for(const name of await caches.keys()){if(name.indexOf("${PAGE_PREFIX}")!==0)continue;const saved=(await(await caches.open(name)).keys()).map((r)=>new URL(r.url)).find((u)=>u.pathname!==location.pathname&&!u.searchParams.has("_rsc"));if(saved){const home=document.getElementById("home");home.href=saved.pathname+saved.search;home.textContent="OPEN A SAVED PAGE";return}}}catch(e){}})()</script></body></html>`

// Next.js's data for a client-side navigation. Kept by its full URL: the _rsc value is a hash of
// the request's router headers, so the same URL always asks for the same data. Offline, a kept
// copy lets the app change page without reloading, which keeps the tap that allows the voice to
// play. With no copy it answers 503, and Next.js loads the page in full, which page() serves.
async function flight(request) {
  const cache = await caches.open(PAGE_CACHE)
  const kept = await cache.match(request)
  try {
    // A slow answer is still waited for (30 s) when no copy is on the device, so a slow page is never cut off.
    const response = await fromMac(request, Boolean(kept))
    if (response.ok && !response.redirected) await cache.put(request, response.clone())
    return response
  } catch {
    return kept || new Response("", { status: 503 })
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
  if (event.data !== MAC_REACHABLE) return
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
