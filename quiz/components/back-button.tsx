"use client"

import { useEffect, useRef } from "react"
import { usePathname, useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { parentPath } from "@/lib/parent-path"
import { cameFromApp, parseScroll, scrollKey } from "@/lib/scroll-memory"
import { readStandalone, useStandalone } from "@/components/standalone"

// A round Back button floating at the bottom left, only in the installed app, which has no browser
// back button. In a browser tab the browser's own back is there, so this one is not shown.
// After a move inside the app it goes back in history; on a page opened directly it goes up a level.
// A page it goes back to opens where it was left: the scroll is saved when the page is left and put
// back once the page is tall enough, since Progress fills in after it opens.
export function BackButton() {
  const pathname = usePathname()
  const router = useRouter()
  const firstPath = useRef(pathname)
  const lastPath = useRef(pathname)
  const movedInApp = useRef(false)
  const popped = useRef(false)
  const restoring = useRef(0)
  const standalone = useStandalone()

  const save = () => {
    if (!readStandalone()) return
    try {
      window.sessionStorage.setItem(scrollKey(lastPath.current), String(Math.max(0, Math.round(window.scrollY))))
    } catch {
      // Without storage the page simply opens at the top.
    }
  }

  const restore = (path: string) => {
    if (!readStandalone()) return
    let target: number | null = null
    try {
      target = parseScroll(window.sessionStorage.getItem(scrollKey(path)))
    } catch {
      // Without storage there is no saved position to put back; the page stays where it opened.
      return
    }
    if (!target) return
    const token = ++restoring.current
    let frames = 0
    let held = 0
    const step = () => {
      if (token !== restoring.current) return
      const tall = document.documentElement.scrollHeight - window.innerHeight >= target
      if (tall || frames > 180) {
        // The router may send the page back to the top just after it opens, so keep it in place for
        // half a second, putting it back only when it was sent to the top.
        if (held === 0 || window.scrollY === 0) window.scrollTo(0, target)
        if (++held > 30) return
      } else frames++
      window.requestAnimationFrame(step)
    }
    step()
  }

  useEffect(() => {
    const installed = readStandalone()
    // A page loaded in full still has the page it came from: Back goes there, not up a level.
    if (installed && cameFromApp(document.referrer, window.location.origin)) movedInApp.current = true
    const navigation = window.performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined
    if (installed && navigation?.type === "back_forward") restore(lastPath.current)
    const onPop = () => {
      if (!readStandalone()) return
      save()
      popped.current = true
    }
    document.addEventListener("click", save, true)
    window.addEventListener("popstate", onPop, true)
    window.addEventListener("pagehide", save)
    return () => {
      document.removeEventListener("click", save, true)
      window.removeEventListener("popstate", onPop, true)
      window.removeEventListener("pagehide", save)
    }
    // Keep listeners stable and check display mode when they run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!readStandalone()) return
    if (pathname !== firstPath.current) movedInApp.current = true
    if (pathname === lastPath.current) return
    lastPath.current = pathname
    if (popped.current) {
      popped.current = false
      restore(pathname)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, standalone])

  const up = parentPath(pathname)
  if (up === null || !standalone) return null

  return (
    <button
      type="button"
      aria-label="Back"
      onClick={() => {
        if (movedInApp.current) {
          popped.current = true
          return router.back()
        }
        // Going up is not a move back through history: the page it opens counts as opened directly,
        // so the next Back goes up again instead of bouncing between the two pages.
        firstPath.current = up
        router.push(up)
      }}
      className="round-float fixed bottom-8 left-8 z-50 flex size-11 items-center justify-center bg-black text-white shadow-lg ring-1 ring-white/20 active:scale-95"
    >
      <ArrowLeft aria-hidden="true" className="size-5" />
    </button>
  )
}
