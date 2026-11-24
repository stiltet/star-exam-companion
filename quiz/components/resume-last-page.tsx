"use client"

import { useEffect } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { isLaunch, LAST_PAGE_KEY, parseLastPage, rememberable, RESUME_MARK, resumeTarget, serialiseLastPage } from "@/lib/last-page"
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

async function canOpen(path: string): Promise<boolean> {
  if (navigator.onLine) return true
  try {
    return (await caches.match(path)) !== undefined
  } catch {
    return false
  }
}

const marked = (): number | null => {
  const value = document.documentElement.getAttribute(RESUME_MARK)
  return value === null ? null : Number(value)
}

// Takes the cover off once `ready` says so and it has shown 500 ms; 3 s after it was drawn whatever happens.
function uncover(ready: () => boolean) {
  const shownAt = marked()
  if (shownAt === null) return
  const timer = window.setInterval(() => {
    const done = Date.now() - shownAt > 3000 || (ready() && loadingRemaining(shownAt, Date.now()) === 0)
    if (!done) return
    window.clearInterval(timer)
    void settled().then(() => document.documentElement.removeAttribute(RESUME_MARK))
  }, 50)
}

const pageReady = () => document.querySelector("[data-page-ready]")?.getAttribute("data-page-ready") === "true"

export function ResumeLastPage() {
  const pathname = usePathname()
  const search = useSearchParams().toString()
  const router = useRouter()

  useEffect(() => {
    if (!readStandalone()) {
      document.documentElement.removeAttribute(RESUME_MARK)
      return
    }
    try {
      const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined
      const firstLoad = !launched && isLaunch(document.referrer, navigation?.type)
      launched = true
      const target = resumeTarget(parseLastPage(window.localStorage.getItem(LAST_PAGE_KEY)), Date.now(), pathname, firstLoad)
      if (target) {
        // Offline, a page the device does not hold would open the "not on this device" page: stay on home then.
        void canOpen(target).then((ok) => {
          if (ok) {
            router.replace(target)
            // The cover stays until the other page is ready: the home page's own gate is still the one in the DOM until then.
            uncover(() => window.location.pathname !== "/" && pageReady())
          } else uncover(pageReady)
        })
        return
      }
      // A launch that stays (a stamp too old, home was last): the cover goes once the page is ready.
      uncover(pageReady)
      const path = pathname + (search ? `?${search}` : "")
      if (rememberable(path)) window.localStorage.setItem(LAST_PAGE_KEY, serialiseLastPage({ path, at: Date.now() }))
    } catch {
      // Without storage the app simply opens on home.
      document.documentElement.removeAttribute(RESUME_MARK)
    }
  }, [pathname, search, router])

  return null
}
