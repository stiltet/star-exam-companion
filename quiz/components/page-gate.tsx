"use client"

import type React from "react"
import { createContext, useContext, useEffect, useLayoutEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { LoadingBox } from "@/components/atoms/loading-box"
import { gateRemaining } from "@/lib/loading-time"
import { settled } from "@/lib/settled"

// A page is shown only when it is ready: hydrated, and every part that loads something after the
// first draw has said it is done (usePageReady). Until then its content is hidden, and after 200 ms
// the app's icon with a filling bar is shown instead, so a slow page never looks stuck. After
// SHOW_ANYWAY_MS the page is shown with whatever it has, so a part that never finishes (the Mac
// unreachable) cannot freeze the app.
export const SHOW_ANYWAY_MS = 5000

// The first page's loading box is drawn by CSS from the moment the page is parsed, so its clock starts at
// the navigation (performance.now() is zero there). A later page's box starts when its gate mounts.
let firstGate = true
function gateStart(): number {
  const start = firstGate ? 0 : performance.now()
  firstGate = false
  return start
}

const Hold = createContext<(() => () => void) | null>(null)

// Called by a part that loads something after the first draw: it holds the page back until `ready`.
export function usePageReady(ready: boolean) {
  const hold = useContext(Hold)
  useLayoutEffect(() => {
    if (ready || !hold) return
    return hold()
  }, [ready, hold])
}

function Gate({ children }: { children: React.ReactNode }) {
  const [hydrated, setHydrated] = useState(false)
  const [pending, setPending] = useState(0)
  const [gaveUp, setGaveUp] = useState(false)
  // True once the page may show. A box that has appeared (after 200 ms) stays 500 ms, so it never flashes.
  const [revealed, setRevealed] = useState(false)
  const [startedAt] = useState(gateStart)
  const [hold] = useState(() => () => {
    setPending((count) => count + 1)
    return () => setPending((count) => count - 1)
  })

  // Runs after every child's layout effect, so each part has registered before the page can show.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- runs once after hydration, which is what the gate waits for
    setHydrated(true)
    const timer = window.setTimeout(() => setGaveUp(true), SHOW_ANYWAY_MS)
    return () => window.clearTimeout(timer)
  }, [])

  const ready = gaveUp || (hydrated && pending === 0)
  // The page shows only when it is ready, its fonts are in and two frames are drawn (settled), and a box that has
  // appeared has stayed LOADING_MIN_MS, so nothing changes or flashes the moment the loading screen goes.
  useEffect(() => {
    if (!ready || revealed) return
    let cancelled = false
    // The box shows 200 ms after the gate started, so what is left of its 500 ms is worked out once the page has settled: a page that
    // was ready just before 200 ms but took longer to settle would otherwise be revealed the moment its box appeared.
    void settled()
      .then(() => new Promise((resolve) => window.setTimeout(resolve, gateRemaining(startedAt, performance.now()))))
      .then(() => {
        if (!cancelled) setRevealed(true)
      })
    return () => {
      cancelled = true
    }
  }, [ready, revealed, startedAt])
  const shown = ready && revealed
  return (
    <Hold.Provider value={hold}>
      <div style={shown ? undefined : { visibility: "hidden" }} data-page-ready={shown ? "true" : "false"}>{children}</div>
      {!shown && (
        <LoadingBox kind="delayed" />
      )}
    </Hold.Provider>
  )
}

// Each page gets its own gate, so a client-side move to another page waits for that page.
export function PageGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  return <Gate key={pathname}>{children}</Gate>
}
