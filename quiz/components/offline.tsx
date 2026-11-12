"use client"

import { useEffect, useState } from "react"
import { ActionButton } from "@/components/atoms/button"
import { Callout } from "@/components/atoms/callout"
import { Text } from "@/components/atoms/text"
import { EXAM_REFRESH_FAILED, examRefreshFailed, resumePageFetches } from "@/lib/exam-header"
import { STATIC_DEMO } from "@/lib/static-demo"

// Why the service worker could not be registered, for the Progress page.
const WORKER_ERROR_KEY = "quiz-worker-error"
const WORKER_FAILED = "quiz-worker-failed"

// Registers the service worker in a production build over HTTPS or on localhost; browsers allow
// none on plain HTTP to the LAN address.
export function OfflineShell() {
  const [refreshFailed, setRefreshFailed] = useState(false)
  const [retrying, setRetrying] = useState(false)
  const [retryFailed, setRetryFailed] = useState(false)
  useEffect(() => {
    const update = () => setRefreshFailed(examRefreshFailed())
    window.addEventListener(EXAM_REFRESH_FAILED, update)
    update()
    return () => window.removeEventListener(EXAM_REFRESH_FAILED, update)
  }, [])
  useEffect(() => {
    // The online demo has no /sw.js and no server to cache for.
    if (STATIC_DEMO || process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return
    void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((error: unknown) => {
      // Shown on the Progress page, so offline mode never fails silently.
      try {
        window.sessionStorage.setItem(WORKER_ERROR_KEY, error instanceof Error ? error.message : String(error))
      } catch {
        // Storage blocked: the Progress page still says "Not ready".
      }
      window.dispatchEvent(new Event(WORKER_FAILED))
    })
  }, [])

  if (!refreshFailed) return null
  return (
    <Callout title="EXAM CHANGED">
      <Text variant="muted" role="alert">
        The Mac now serves another exam, but this device could not load it. Try again; queued answers stay on this device.
        {retryFailed ? " It still could not load it. Try again in a moment." : ""}
      </Text>
      <ActionButton variant="outlined" disabled={retrying} onClick={() => {
        setRetrying(true)
        setRetryFailed(false)
        void resumePageFetches().then((ready) => {
          if (ready) window.location.reload()
          else { setRetrying(false); setRetryFailed(true) }
        })
      }}>{retrying ? "Checking…" : "Try loading again"}</ActionButton>
    </Callout>
  )
}

export type OfflineStatus = { secure: boolean; ready: boolean; error: string | null }

// Secure: the page is on HTTPS (or localhost). Ready: a service worker runs this page and has its pages stored.
// The last answer, kept in memory, so a panel built afresh each time it opens shows it at once.
let lastStatus: OfflineStatus | null = null

export function useOfflineStatus(): OfflineStatus | null {
  const [status, setStatus] = useState<OfflineStatus | null>(lastStatus)
  useEffect(() => {
    let live = true
    const check = async () => {
      const secure = window.isSecureContext
      let ready = false
      if (secure && "serviceWorker" in navigator && navigator.serviceWorker.controller && "caches" in window) {
        try {
          ready = (await caches.keys()).some((name) => name.startsWith("quiz-pages-"))
        } catch {
          // A browser refuses storage calls while the page is unloading ("Context is stopped" in WebKit): not ready, not an error.
        }
      }
      let error: string | null = null
      try {
        error = window.sessionStorage.getItem(WORKER_ERROR_KEY)
      } catch {
        // Storage blocked: no reason to show.
      }
      lastStatus = { secure, ready, error }
      if (live) setStatus(lastStatus)
    }
    void check()
    // The first visit installs the worker after the page has loaded; check again when it takes over.
    navigator.serviceWorker?.addEventListener("controllerchange", check)
    // A failed registration is reported after the page has loaded; show its reason when it is.
    window.addEventListener(WORKER_FAILED, check)
    return () => {
      live = false
      navigator.serviceWorker?.removeEventListener("controllerchange", check)
      window.removeEventListener(WORKER_FAILED, check)
    }
  }, [])
  return status
}
