"use client"

import { useEffect, useLayoutEffect, useState } from "react"
import { LoadingBox } from "@/components/atoms/loading-box"
import { routeRemaining } from "@/lib/loading-time"

// A Read Aloud page that comes after the route box (app/read/loading.tsx) has shown must not take it away before it has stayed 500 ms.
// The box tells when it mounted; the page that replaces it keeps itself hidden behind an ordinary loading box for what is left.
let routeBoxMountedAt: number | null = null
// When the box was really seen: its CSS animation ends 200 ms after it mounted, a frame or so later than the mount time says.
let routeBoxShownAt: number | null = null

export function RouteBoxMark() {
  useLayoutEffect(() => {
    routeBoxMountedAt = performance.now()
    routeBoxShownAt = null
    const box = document.querySelector(".loading-route")
    const seen = () => {
      routeBoxShownAt = performance.now()
    }
    box?.addEventListener("animationend", seen, { once: true })
    return () => box?.removeEventListener("animationend", seen)
  }, [])
  return null
}

export function RouteHold({ className, children }: { className?: string; children: React.ReactNode }) {
  // A page drawn by the server for a first load has no route box before it (null): nothing is held and nothing differs between server and client.
  const [remaining] = useState(() => (typeof window === "undefined" ? 0 : routeRemaining(routeBoxMountedAt, performance.now(), routeBoxShownAt)))
  const [held, setHeld] = useState(remaining > 0)
  // Read without clearing in the first render (React may render it twice); a mark that is old has nothing left to hold anyway.
  useEffect(() => {
    routeBoxMountedAt = null
    routeBoxShownAt = null
    if (remaining <= 0) return
    const timer = window.setTimeout(() => setHeld(false), remaining)
    return () => window.clearTimeout(timer)
  }, [remaining])
  return (
    <>
      <div className={className} style={held ? { visibility: "hidden" } : undefined} data-route-hold={held ? "true" : undefined}>{children}</div>
      {held && <LoadingBox />}
    </>
  )
}
