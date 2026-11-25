"use client"

import { useEffect, useState } from "react"
import { flushSync } from "react-dom"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { LoadingBox } from "@/components/atoms/loading-box"
import { applyFinish, canOpenPage, isLaunch, LAST_PAGE_KEY, parseLastPage, placeToRestore, rememberable, RESUME_MARK, resumeTarget, serialiseLastPage, watchStep } from "@/lib/last-page"
import { loadingRemaining } from "@/lib/loading-time"
import { settled } from "@/lib/settled"
import { readStandalone } from "@/components/standalone"

// Installed app only. iOS ends the app in the background, and the next launch opens home. This writes
// down every page the visitor is on (home included, and a change of query), and on the first mount
// after a launch, if that opens home, moves to the page left within the last 24 hours. The flag lives
// in memory, so it is false again on every launch and a tap on Home inside the app is never a launch.
//
// A launch that will move is covered by the loading box from the first frame (RESUME_SCRIPT marks <html>).
// The cover goes when the other page is ready, and never before it has shown 500 ms.
let launched = false
// Scroll is saved only once a resume has finished, so the top of the page it opens on never overwrites the saved place.
let saving = false
// True from the decision to move to the saved page until it is back in place.
let resuming = false

function save(path?: string) {
  if (!saving || !readStandalone()) return
  const here = window.location.pathname + window.location.search
  if (!rememberable(here) || (path !== undefined && path !== here)) return
  try {
    window.localStorage.setItem(LAST_PAGE_KEY, serialiseLastPage({ path: here, at: Date.now(), scroll: Math.round(window.scrollY) }))
  } catch {
    // Without storage the app simply opens at the top.
  }
}

const canOpen = (path: string) => canOpenPage(navigator.onLine, async () => (await caches.match(path)) !== undefined)

// The launch cover is done. Its box stops being a loading element too, so nothing on the page says it is loading
// when it is not (the hidden cover is still in the page).
function endCover() {
  document.documentElement.removeAttribute(RESUME_MARK)
  document.querySelector(".resume-cover [data-loading]")?.removeAttribute("data-loading")
}

const marked = (): number | null => {
  const value = document.documentElement.getAttribute(RESUME_MARK)
  return value === null ? null : Number(value)
}

// One watch at a time: a second call (a new move while the cover is still up) takes the first one's place.
let watching = 0
// The setter of the slow-page box, so whichever watch finishes last can take the box down.
let lastSlow: ((on: boolean) => void) | undefined
// When the slow-page box came up, so a newer watch keeps its 500 ms too. Null while no box shows.
let slowShownAt: number | null = null

// Takes the cover off once `ready` says so and it has shown 500 ms. 3 s after it was drawn it goes whatever happens, which
// is the same limit as the failsafe in globals.css (it works with no script). The restore of the place, and the start of
// saving, wait for the page itself, up to 30 s, so a page that is still coming is never saved as the place (home at the top).
// When the cover goes at the limit with the saved page still not there, a loading box of the usual kind (over the whole page,
// hiding it) takes its place, so home is never seen bare while the saved page is coming. `slow` shows and hides it, and
// it too stays 500 ms once shown.
function uncover(ready: () => boolean, restore?: () => void, showSlow?: (on: boolean) => void) {
  window.clearInterval(watching)
  // The newest watch also ends a box an older one showed, even when it was not given the setter itself.
  const slow = showSlow ?? lastSlow
  lastSlow = slow
  // With no cover drawn (the early script did not mark this launch) there is no minimum to keep, but the move is still waited for.
  const drawnAt = marked()
  const startedAt = drawnAt ?? Date.now()
  let covered = drawnAt !== null
  const timer = watching = window.setInterval(() => {
    const now = Date.now()
    const isReady = ready()
    // Held: the launch cover has shown its 500 ms (when one was drawn), and the slow-page box, if it came, has shown its own.
    const held = (drawnAt === null || loadingRemaining(startedAt, now) === 0) && loadingRemaining(slowShownAt, now) === 0
    const step = watchStep(now - startedAt, covered, isReady, held)
    if (step.endCover) {
      covered = false
      // The box is drawn in this very frame, before the cover goes, so home is never seen bare between the two.
      if (restore && slow && !isReady && slowShownAt === null) {
        slowShownAt = now
        flushSync(() => slow(true))
      }
      endCover()
    }
    if (!step.finish) return
    const finish = step.finish
    window.clearInterval(timer)
    void settled().then(() => {
      // A newer call took over the watch while the page settled: it restores and ends the cover, not this one.
      if (watching !== timer) return
      // The page is drawn and hidden behind the cover: put it where it was left before the cover goes.
      // A saved page that never came: saving starts again with the next page the visitor opens, never with home at the top.
      applyFinish(finish, restore, () => {
        resuming = false
      })
      endCover()
      slowShownAt = null
      slow?.(false)
    })
  }, 50)
}

const pageReady = () => document.querySelector("[data-page-ready]")?.getAttribute("data-page-ready") === "true"

export function ResumeLastPage() {
  const pathname = usePathname()
  const search = useSearchParams().toString()
  const router = useRouter()
  // True while the saved page is still coming after the launch cover has gone.
  const [slow, setSlow] = useState(false)

  useEffect(() => {
    if (!readStandalone()) {
      endCover()
      return
    }
    try {
      const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined
      const firstLoad = !launched && isLaunch(document.referrer, navigation?.type)
      launched = true
      const saved = parseLastPage(window.localStorage.getItem(LAST_PAGE_KEY))
      const target = resumeTarget(saved, Date.now(), pathname, firstLoad)
      if (!target && !resuming) saving = true
      if (target) resuming = true
      if (target) {
        // Offline, a page the device does not hold would open the "not on this device" page: stay on home then.
        void canOpen(target).then((ok) => {
          if (ok) {
            router.replace(target)
            // The cover stays until the other page is ready: the home page's own gate is still the one in the DOM until then.
            uncover(() => window.location.pathname !== "/" && pageReady(), () => {
              // Only on the saved page itself: a visitor who tapped on to another page meanwhile keeps that page's own place.
              const place = placeToRestore(window.location.pathname + window.location.search, target, saved?.scroll)
              if (place !== null) window.scrollTo(0, place)
              resuming = false
              saving = true
            }, setSlow)
          } else {
            resuming = false
            saving = true
            uncover(pageReady)
          }
        })
        return
      }
      // A launch that stays (a stamp too old, home was last): the cover goes once the page is ready.
      if (!resuming) uncover(pageReady)
      const path = pathname + (search ? `?${search}` : "")
      // While the move to the saved page is under way its record, scroll included, is left alone.
      // The same page again (a reload) keeps the place it was left at, until the scroll is saved afresh.
      if (!resuming && rememberable(path)) window.localStorage.setItem(LAST_PAGE_KEY, serialiseLastPage({ path, at: Date.now(), scroll: saved?.path === path ? saved.scroll : 0 }))
    } catch {
      // Without storage the app simply opens on home.
      endCover()
    }
  }, [pathname, search, router])

  // Where the page is scrolled to is saved as it scrolls (after a pause) and when the app is left, so a launch opens there.
  useEffect(() => {
    let timer = 0
    const onScroll = () => {
      window.clearTimeout(timer)
      const at = window.location.pathname + window.location.search
      timer = window.setTimeout(() => save(at), 200)
    }
    const flush = () => {
      window.clearTimeout(timer)
      save()
    }
    const onHide = () => {
      if (document.visibilityState === "hidden") flush()
    }
    window.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("pagehide", flush)
    document.addEventListener("visibilitychange", onHide)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener("scroll", onScroll)
      window.removeEventListener("pagehide", flush)
      document.removeEventListener("visibilitychange", onHide)
    }
  }, [])

  return slow ? <LoadingBox /> : null
}
