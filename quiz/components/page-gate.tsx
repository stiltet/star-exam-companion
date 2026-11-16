"use client"

import type React from "react"
import { createContext, useContext, useEffect, useLayoutEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { LoadingBox } from "@/components/atoms/loading-box"

// A page is shown only when it is ready: hydrated, and every part that loads something after the
// first draw has said it is done (usePageReady). Until then its content is hidden, and after 200 ms
// the app's icon with a filling bar is shown instead, so a slow page never looks stuck. After
// SHOW_ANYWAY_MS the page is shown with whatever it has, so a part that never finishes (the Mac
// unreachable) cannot freeze the app.
export const SHOW_ANYWAY_MS = 5000

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
  return (
    <Hold.Provider value={hold}>
      <div style={ready ? undefined : { visibility: "hidden" }} data-page-ready={ready ? "true" : "false"}>{children}</div>
      {!ready && (
        <LoadingBox delayed />
      )}
    </Hold.Provider>
  )
}

// Each page gets its own gate, so a client-side move to another page waits for that page.
export function PageGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  return <Gate key={pathname}>{children}</Gate>
}
