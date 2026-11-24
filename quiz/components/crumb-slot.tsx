"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { Breadcrumb, type Crumb } from "@/components/atoms/breadcrumb"

// The breadcrumb bar of PageShell. A page whose trail never changes gives it to PageShell; a page whose trail follows its own
// state (Flashcards, once a session starts) sets it with useBreadcrumb, and the same fixed bar shows it.
const Value = createContext<Crumb[] | null>(null)
const Setter = createContext<(trail: Crumb[] | null) => void>(() => {})
// A second bar under the breadcrumb or the header, full width like it (the Test exam's timer). It sits in the same fixed stack.
const BarValue = createContext<ReactNode>(null)
const BarSetter = createContext<(bar: ReactNode) => void>(() => {})

export function CrumbProvider({ initial, children }: { initial?: Crumb[]; children: ReactNode }) {
  const [trail, setTrail] = useState<Crumb[] | null>(initial ?? null)
  const [bar, setBar] = useState<ReactNode>(null)
  return (
    <Setter.Provider value={setTrail}>
      <Value.Provider value={trail}>
        <BarSetter.Provider value={setBar}>
          <BarValue.Provider value={bar}>{children}</BarValue.Provider>
        </BarSetter.Provider>
      </Value.Provider>
    </Setter.Provider>
  )
}

// The bar a page puts under the header (and its breadcrumb): full width, with its content in the page's container.
export function SubBar() {
  const bar = useContext(BarValue)
  return bar ? <div data-sub-bar className="border-b-2 border-foreground">{bar}</div> : null
}

export function useSubBar(bar: ReactNode) {
  const set = useContext(BarSetter)
  useEffect(() => {
    set(bar)
  })
  useEffect(() => () => set(null), [set])
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
