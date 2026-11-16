import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import test from "node:test"

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8")

test("the tapped link shows the loading state after 200 ms and locks every other tap, for every link, with no root loading screen", () => {
  assert.equal(existsSync(new URL("../app/loading.tsx", import.meta.url)), false)
  assert.match(read("app/layout.tsx"), /<NavProgress \/>/)
  const nav = read("components/nav-progress.tsx")
  assert.match(nav, /SPINNER_AFTER_MS = 200\n/)
  assert.match(nav, /event\.preventDefault\(\)/)
  assert.match(nav, /showExternal\(target\)/, "a link to another site shows loading too")
  assert.match(nav, /header a:has\(img\)/, "the logo link never changes itself, the box shows instead")
  assert.doesNotMatch(nav, /CLEAR_MS|setTimeout\(finish/, "a loading button never goes back to normal by itself")
  assert.match(read("app/globals.css"), /\[data-loading\]::after/)
  assert.match(read("app/globals.css"), /animation: link-fill/)
})

test("a page is shown only when ready: the layout gates every page, parts that load late hold it, and it is shown anyway after 5 s", () => {
  assert.match(read("app/layout.tsx"), /<PageGate>\{children\}<\/PageGate>/)
  const gate = read("components/page-gate.tsx")
  assert.match(gate, /SHOW_ANYWAY_MS = 5000\n/)
  assert.match(gate, /visibility: "hidden"/)
  assert.match(read("app/globals.css"), /\.page-loading \{[^}]*animation: page-loading-show 0s linear 200ms/)
  assert.match(read("app/globals.css"), /\[data-page-ready="false"\] \{[^}]*animation: page-open 0s linear 5s/)
  for (const part of ["voice-round", "practice-unanswered", "progress-client", "exam-client"]) {
    assert.match(read(`components/${part}.tsx`), /usePageReady\(/, part)
  }
})

test("the logo and title link holds an image, so the loading box (not the header) shows when it is tapped, and a tapped link says it is busy", () => {
  const header = read("components/site-header-view.tsx")
  assert.match(header, /<Link href="\/"[^>]*>\s*<Image /, "the logo link holds an <img>, which header a:has(img) matches")
  const nav = read("components/nav-progress.tsx")
  assert.match(nav, /setAttribute\("aria-busy", "true"\)/)
  assert.match(nav, /if \(link\.hasAttribute\("data-loading"\)\) return/, "marking busy twice keeps the first label")
  assert.match(nav, /if \(!link\.hasAttribute\("data-loading"\)\) return/, "marking idle twice never strips the link's own label")
})
