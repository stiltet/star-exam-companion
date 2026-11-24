"use client"

import { useEffect, useRef, useState } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { LoadingBox } from "@/components/atoms/loading-box"
import { LOADING_AFTER_MS, loadingRemaining } from "@/lib/loading-time"

const SPINNER_AFTER_MS = LOADING_AFTER_MS
const clock = () => performance.now()
// After this long other links can be tapped again, so the app can never stay stuck. A button that
// shows loading NEVER goes back to normal by itself (owner, 16 Nov): it stays until the page
// arrives, because a button that returns to normal and navigates seconds later looks like a tap
// that did nothing.
const UNLOCK_MS = 6000
// A link that opens in the in-app browser opens at once: the browser loads the page itself, in its own
// window, so asking the site first only doubled the wait (owner, 16 Nov). Nothing tells the app when that
// page has loaded, so the button shows loading from the tap and returns to normal when you come back,
// or after this long.
const EXTERNAL_MS = 3000

// The tapped link shows loading (globals.css draws it: its words go and the icon fills). The words are
// gone from the screen, so the link keeps its name for a screen reader by aria-label, and says it is busy.
function markBusy(link: HTMLElement) {
  // Already busy: a second call would take the busy label for the link's own.
  if (link.hasAttribute("data-loading")) return
  link.style.setProperty("--spinner", getComputedStyle(link).color)
  const prior = link.getAttribute("aria-label")
  if (prior !== null) link.dataset.priorLabel = prior
  link.setAttribute("aria-label", (prior ?? link.textContent ?? "").replace(/\s+/g, " ").trim())
  link.setAttribute("aria-busy", "true")
  link.setAttribute("data-loading", "true")
}

function markIdle(link: HTMLElement) {
  // Not busy (already restored by another path): a second call would strip a label the link owns.
  if (!link.hasAttribute("data-loading")) return
  link.removeAttribute("data-loading")
  link.removeAttribute("aria-busy")
  link.style.removeProperty("--spinner")
  if (link.dataset.priorLabel !== undefined) {
    link.setAttribute("aria-label", link.dataset.priorLabel)
    delete link.dataset.priorLabel
  } else {
    link.removeAttribute("aria-label")
  }
}

// The tapped link is the loading indicator, wherever the tap was (globals.css draws it): after 200 ms
// its words are replaced by a turning square, so a quick page never flashes it. From the tap until the
// new page is there, every further tap on a link is refused. Nothing covers the page, so scrolling
// always works. One listener for every link in the app.
export function NavProgress() {
  const pathname = usePathname()
  // A move that changes only the query (a Practice filter) is a move too: the tapped link loads and the others are locked.
  const search = useSearchParams().toString()
  const from = useRef<string | null>(null)
  const link = useRef<HTMLAnchorElement | null>(null)
  const locked = useRef(false)
  // The logo and title link: the header never changes, so the page-sized loading box shows instead.
  const [overlay, setOverlay] = useState(false)
  const timers = useRef<number[]>([])
  // When the loading state appeared, and the end of a move that is waiting for it to have shown 500 ms.
  const shownAt = useRef<number | null>(null)
  const ending = useRef(0)

  // The page has arrived. A loading state that has shown stays until it has shown 500 ms, so it never flashes.
  const finish = () => {
    const wait = loadingRemaining(shownAt.current, clock())
    if (wait <= 0) return finishNow()
    timers.current.forEach((timer) => window.clearTimeout(timer))
    timers.current = []
    if (ending.current === 0) ending.current = window.setTimeout(finishNow, wait)
  }

  const finishNow = () => {
    window.clearTimeout(ending.current)
    ending.current = 0
    shownAt.current = null
    timers.current.forEach((timer) => window.clearTimeout(timer))
    timers.current = []
    // The page has arrived (or come back from memory): only now do loading buttons go back to normal.
    document.querySelectorAll<HTMLElement>("a[data-loading]").forEach(markIdle)
    link.current = null
    from.current = null
    locked.current = false
    setOverlay(false)
  }

  // The link that opens outside the app: loading at once, no lock (the app stays usable), and back to
  // normal when you return to the app or after EXTERNAL_MS. The link itself opens as it always did.
  const showExternal = (target: HTMLAnchorElement) => {
    markBusy(target)
    const back = () => {
      window.clearTimeout(timer)
      document.removeEventListener("visibilitychange", onVisible)
      window.removeEventListener("pageshow", back)
      markIdle(target)
    }
    const onVisible = () => {
      if (document.visibilityState === "visible") back()
    }
    const timer = window.setTimeout(back, EXTERNAL_MS)
    document.addEventListener("visibilitychange", onVisible)
    window.addEventListener("pageshow", back)
  }

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      // Waiting for a page: no other link can be tapped.
      if (locked.current && (event.target as Element | null)?.closest?.("a")) {
        event.preventDefault()
        event.stopPropagation()
        return
      }
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const target = (event.target as Element | null)?.closest?.("a")
      if (!target || target.hasAttribute("download")) return
      const url = new URL(target.href, window.location.href)
      if (/^https?:$/.test(url.protocol) && (target.target === "_blank" || url.origin !== window.location.origin)) {
        showExternal(target)
        return
      }
      if (target.target === "_blank") return
      if (url.origin !== window.location.origin) return
      // The same page again (only the #hash differs) is no move.
      if (url.pathname === window.location.pathname && url.search === window.location.search) return
      // The logo and title link never changes itself (owner, 16 Nov): the loading box is shown over the page.
      const logo = target.matches("header a:has(img)")
      // A button still waiting after being unlocked stays loading, and the new tap waits beside it.
      if (from.current !== null) {
        timers.current.forEach((timer) => window.clearTimeout(timer))
        timers.current = []
      }
      link.current = target
      from.current = window.location.pathname + window.location.search
      locked.current = true
      timers.current.push(window.setTimeout(() => {
        shownAt.current = clock()
        if (logo) return setOverlay(true)
        markBusy(target)
      }, SPINNER_AFTER_MS))
      timers.current.push(window.setTimeout(() => { locked.current = false }, UNLOCK_MS))
    }
    document.addEventListener("click", onClick, true)
    return () => document.removeEventListener("click", onClick, true)
  }, [])

  useEffect(() => {
    // The page or its query changed: the move has arrived.
    if (from.current !== null && from.current !== window.location.pathname + window.location.search) finish()
  }, [pathname, search])

  // A page restored from the back/forward cache must not come back still waiting.
  useEffect(() => {
    window.addEventListener("pageshow", finish)
    return () => window.removeEventListener("pageshow", finish)
  }, [])

  return overlay ? <LoadingBox /> : null
}
