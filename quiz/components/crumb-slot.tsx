"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { Breadcrumb, type Crumb } from "@/components/atoms/breadcrumb"

// The breadcrumb bar of PageShell. A page whose trail never changes gives it to PageShell; a page whose trail follows its own
// state (Flashcards, once a session starts) sets it with useBreadcrumb, and the same fixed bar shows it.
const Value = createContext<Crumb[] | null>(null)
const Setter = createContext<(trail: Crumb[] | null) => void>(() => {})

export function CrumbProvider({ initial, children }: { initial?: Crumb[]; children: ReactNode }) {
  const [trail, setTrail] = useState<Crumb[] | null>(initial ?? null)
  return (
    <Setter.Provider value={setTrail}>
      <Value.Provider value={trail}>{children}</Value.Provider>
    </Setter.Provider>
  )
}

export function CrumbBar() {
  const trail = useContext(Value)
  return trail ? (
    <div data-crumb-bar className="border-b border-border">
      <div className="max-w-4xl mx-auto px-4 py-2"><Breadcrumb trail={trail} /></div>
    </div>
  ) : null
}

export function useBreadcrumb(trail: Crumb[] | null) {
  const set = useContext(Setter)
  const key = trail ? JSON.stringify(trail.map((crumb) => [crumb.label, crumb.href ?? null])) : ""
  useEffect(() => {
    set(trail)
    return () => set(null)
    // A crumb's onClick only calls state setters, so the trail is set again only when its labels or links change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, set])
}
