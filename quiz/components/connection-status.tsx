"use client"

import { useEffect, useState } from "react"
import { fetchedAt, fetchSnapshot, REFRESHED, useSnapshot } from "@/components/snapshot"
import { connectionText, forceUpdate, type Connection } from "@/lib/connection"
import { STATIC_DEMO } from "@/lib/static-demo"

// Asks the browser to fetch the latest worker now. A new build's worker installs and stores its
// pages before it takes over and drops the old caches, so offline keeps working throughout.
async function refreshWorker(): Promise<void> {
  if (!("serviceWorker" in navigator)) return
  try {
    const registration = await navigator.serviceWorker.getRegistration()
    await registration?.update()
  } catch {
    // No worker to ask, or the page is unloading ("Context is stopped" in WebKit): the next visit asks again.
  }
}

// A laptop, for the Mac: a tick on its screen when the questions came fresh from it, a slash
// through it otherwise. Drawn in the same style as the other icons.
function LaptopStatus({ live }: { live: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="size-6" aria-hidden>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M2 20h20" />
      {live ? <path d="m9 10 2 2 4-4" /> : <path d="M2 2l20 20" />}
    </svg>
  )
}

export type ConnectionState = {
  from: Connection
  long: string
  busy: boolean
  update: () => void
}

// Whether the questions are live from the Mac or an offline copy, and Update now.
export function useConnection(): ConnectionState {
  const { from } = useSnapshot()
  const [at, setAt] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const read = () => setAt(fetchedAt())
    read()
    window.addEventListener(REFRESHED, read)
    return () => window.removeEventListener(REFRESHED, read)
  }, [])

  const update = async () => {
    setBusy(true)
    let fetched: Awaited<ReturnType<typeof fetchSnapshot>> = null
    try {
      const result = await forceUpdate({
        fetchSnapshot: async () => {
          fetched = await fetchSnapshot()
          return fetched && "snapshot" in fetched ? fetched.snapshot : null
        },
        store: window.localStorage,
        refreshWorker,
        reload: () => window.location.reload(),
        now: () => new Date(),
      })
      // Every open page and the header show what the Mac answered: a fresh copy, a glossary row it
      // cannot read, or nothing, which means the device copy.
      window.dispatchEvent(new CustomEvent(REFRESHED, { detail: fetched }))
      if (result === "updated") return
    } catch {
      // Not reached in practice: forceUpdate catches a failed worker refresh itself.
    }
    setBusy(false)
  }

  return { from, long: connectionText(from, at), busy, update: () => void update() }
}

// In the bar, left of the menu button: a status icon only, the size of the menu button. Green
// only when the questions came fresh from the Mac; red otherwise, including while it checks, so
// an old copy never looks current. Update now is on the Progress page.
export function ConnectionIcon({ state }: { state: ConnectionState }) {
  // The online demo has no local server, so a red "cannot reach it" icon would only mislead.
  if (STATIC_DEMO) return null
  const { from, long } = state
  const live = from === "mac"
  return (
    <span role="img" aria-label={long} title={long} className={`flex size-11 shrink-0 items-center justify-center ${live ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
      <LaptopStatus live={live} />
    </span>
  )
}
