import assert from "node:assert/strict"
import test from "node:test"
import { canOpenPage, isLaunch, LAST_PAGE_MAX_AGE_MS, RESUME_SCRIPT, parseLastPage, rememberable, resumeTarget, serialiseLastPage } from "./last-page.ts"

const now = 1_000_000_000_000

test("api routes, files and other origins are not remembered", () => {
  for (const path of ["/api/speak", "//evil.test/x", "https://evil.test/", "/\\evil.test", "/a\\b", "/sw.js", "/icon.png", ""]) assert.equal(rememberable(path), false, path)
  for (const path of ["/", "/practice?section=a", "/study/x/y", "/read/night"]) assert.equal(rememberable(path), true, path)
})

test("a stored page round-trips and junk is no page", () => {
  const page = { path: "/study/a", at: now, scroll: 1234 }
  assert.deepEqual(parseLastPage(serialiseLastPage(page)), page)
  // A record without a usable scroll opens at the top.
  assert.equal(parseLastPage('{"path":"/study/a","at":1}')?.scroll, 0)
  assert.equal(parseLastPage('{"path":"/study/a","at":1,"scroll":-5}')?.scroll, 0)
  for (const raw of [null, "x", "[]", '{"path":1,"at":2}', '{"path":"/a"}']) assert.equal(parseLastPage(raw), null, String(raw))
})

test("a first load on home resumes a page younger than 24 hours", () => {
  const saved = { path: "/practice?topic=t", at: now - 60_000, scroll: 0 }
  assert.equal(resumeTarget(saved, now, "/", true), "/practice?topic=t")
  assert.equal(resumeTarget({ ...saved, at: now - LAST_PAGE_MAX_AGE_MS }, now, "/", true), saved.path)
})

test("an old, future, missing, non-first or non-home case stays put", () => {
  const saved = { path: "/study/a", at: now - 1000, scroll: 0 }
  assert.equal(resumeTarget({ ...saved, at: now - LAST_PAGE_MAX_AGE_MS - 1 }, now, "/", true), null)
  assert.equal(resumeTarget({ ...saved, at: now + 5000 }, now, "/", true), null)
  assert.equal(resumeTarget(null, now, "/", true), null)
  assert.equal(resumeTarget(saved, now, "/", false), null)
  assert.equal(resumeTarget(saved, now, "/progress", true), null)
  // Left on home: a launch opens home, not an older page.
  assert.equal(resumeTarget({ path: "/", at: now - 1000, scroll: 0 }, now, "/", true), null)
})

// The script that marks the page before it is drawn must agree with resumeTarget.
function marked(saved: string | null, pathname: string, standalone: boolean, at = Date.now(), referrer = "", navType = "navigate"): boolean {
  const attrs: Record<string, string> = {}
  const doc = { referrer, documentElement: { setAttribute: (k: string, v: string) => { attrs[k] = v } } }
  const store = { getItem: () => (saved === null ? null : saved.replace("%AT%", String(at))) }
  new Function("document", "navigator", "matchMedia", "location", "localStorage", "performance", RESUME_SCRIPT)(doc, { standalone }, () => ({ matches: false }), { pathname }, store, { getEntriesByType: () => [{ type: navType }] })
  return "data-resuming" in attrs
}

test("the early script marks exactly the launches resumeTarget moves", () => {
  const page = '{"path":"/study/a","at":%AT%}'
  assert.equal(marked(page, "/", true), true)
  assert.equal(marked(page, "/", false), false)
  assert.equal(marked(page, "/progress", true), false)
  assert.equal(marked('{"path":"/","at":%AT%}', "/", true), false)
  assert.equal(marked(page, "/", true, Date.now() - LAST_PAGE_MAX_AGE_MS - 5000), false)
  assert.equal(marked(null, "/", true), false)
  assert.equal(marked("junk", "/", true), false)
  // A tap on a link inside the app that loads the whole page, a reload and Back are not launches.
  assert.equal(marked(page, "/", true, Date.now(), "https://quiz.test/read/1"), false)
  assert.equal(marked(page, "/", true, Date.now(), "", "reload"), false)
  assert.equal(marked(page, "/", true, Date.now(), "", "back_forward"), false)
  assert.equal(isLaunch("", "navigate"), true)
  assert.equal(isLaunch("", undefined), true)
  assert.equal(isLaunch("https://quiz.test/x", "navigate"), false)
  assert.equal(isLaunch("", "reload"), false)
})

test("offline, only a page the device holds opens; online it always does; a cache that fails counts as not held", async () => {
  assert.equal(await canOpenPage(true, async () => false), true)
  assert.equal(await canOpenPage(false, async () => true), true)
  assert.equal(await canOpenPage(false, async () => false), false)
  assert.equal(await canOpenPage(false, async () => { throw new Error("no cache") }), false)
})
