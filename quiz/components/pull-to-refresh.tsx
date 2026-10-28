"use client"

import { useEffect, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import { RotateCw } from "lucide-react"
import { inDeadZone, isReady, isVerticalPull, pullAllowedOn, pullDistance, shouldRefresh } from "@/lib/pull"

// Opened from the home screen, the app runs standalone, where iOS gives no pull-to-refresh.
// Pulling down at the top of a page shows a round refresh button, like Back, and reloads on release.
// In Safari, which has its own, this does nothing. On Exam, Voice Quiz, Practice and Flashcards it is
// off: a reload there would lose the round in progress.
function standalone(): boolean {
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true
  return iosStandalone || window.matchMedia("(display-mode: standalone)").matches
}

export function PullToRefresh() {
  const pathname = usePathname()
  const [pull, setPull] = useState(0)
  const start = useRef<{ x: number; y: number } | null>(null)
  const drag = useRef(0)

  useEffect(() => {
    if (!standalone() || !pullAllowedOn(pathname)) return
    const cancel = () => {
      start.current = null
      drag.current = 0
      setPull(0)
    }
    const onStart = (event: TouchEvent) => {
      // Only a one-finger pull that starts at the very top, so scrolling and pinching never reload.
      const touch = event.touches[0]
      start.current = event.touches.length === 1 && touch && window.scrollY <= 0 ? { x: touch.clientX, y: touch.clientY } : null
      drag.current = 0
    }
    const onMove = (event: TouchEvent) => {
      const touch = event.touches[0]
      if (!start.current || !touch) return
      const dx = touch.clientX - start.current.x
      const dy = touch.clientY - start.current.y
      // The dead zone only delays the start; once a pull is under way, every move counts.
      if (drag.current === 0 && inDeadZone(dx, dy)) return
      // Scrolled away from the top, a second finger or a sideways swipe: not a pull any more.
      if (window.scrollY > 0 || event.touches.length > 1 || !isVerticalPull(dx, dy)) return cancel()
      drag.current = dy
      setPull(pullDistance(dy))
    }
    const onEnd = () => {
      if (start.current && shouldRefresh(drag.current)) window.location.reload()
      cancel()
    }
    window.addEventListener("touchstart", onStart, { passive: true })
    window.addEventListener("touchmove", onMove, { passive: true })
    window.addEventListener("touchend", onEnd)
    window.addEventListener("touchcancel", cancel)
    return () => {
      // A page change mid-pull must not leave the indicator, or a half-tracked touch, behind.
      start.current = null
      drag.current = 0
      setPull(0)
      window.removeEventListener("touchstart", onStart)
      window.removeEventListener("touchmove", onMove)
      window.removeEventListener("touchend", onEnd)
      window.removeEventListener("touchcancel", cancel)
    }
  }, [pathname])

  if (pull === 0) return null
  return (
    <div
      aria-hidden="true"
      className="round-float pointer-events-none fixed left-1/2 top-2 z-50 flex size-11 items-center justify-center bg-black text-white shadow-lg ring-1 ring-white/20"
      style={{ transform: `translate(-50%, ${pull}px) rotate(${pull * 3}deg)`, opacity: Math.min(1, pull / 40) }}
    >
      <RotateCw className={`size-5 ${isReady(pull) ? "" : "opacity-60"}`} />
    </div>
  )
}
