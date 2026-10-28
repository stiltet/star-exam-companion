"use client"

import { useEffect, useState } from "react"
import { CHANGED } from "@/components/outbox"
import { storeVoice } from "@/components/voice-cache"
import type { ScoreLine } from "@/lib/learn"
import { mergeLines, readOutbox } from "@/lib/outbox"
import { SNAPSHOT_AT_KEY } from "@/lib/connection"
import { isSnapshot, readSnapshot, writeSnapshot, type Snapshot } from "@/lib/snapshot"

// The same wait the service worker gives the Mac before it falls back to the device.
const FETCH_TIMEOUT_MS = 2500

export type SnapshotState = {
  snapshot: Snapshot | null
  // mac: fresh from the Mac. device: the copy kept on this device. none: neither.
  from: "loading" | "mac" | "device" | "none"
  // A glossary row the Mac cannot read. Shown by name; nothing is guessed.
  broken: { row: string; error: string } | null
  // The Mac's lines plus the answers still on this device, in answer order.
  lines: ScoreLine[]
}

export async function fetchSnapshot(): Promise<{ snapshot: Snapshot } | { broken: { row: string; error: string } } | null> {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const response = await fetch("/api/snapshot", { cache: "no-store", signal: controller.signal })
    const body = (await response.json()) as { ok?: boolean; snapshot?: unknown; row?: unknown; error?: unknown }
    if (response.status === 409 && typeof body.row === "string" && typeof body.error === "string") return { broken: { row: body.row, error: body.error } }
    return response.ok && body.ok === true && isSnapshot(body.snapshot) ? { snapshot: body.snapshot } : null
  } catch {
    // Offline, or the Mac is asleep: the caller uses the copy on the device.
    return null
  } finally {
    window.clearTimeout(timer)
  }
}

type Fetched = Awaited<ReturnType<typeof fetchSnapshot>>

// Sent after every refresh, fresh or failed, so the header and open pages show the current state.
export const REFRESHED = "quiz-snapshot-refreshed"

// When the copy on the device last came from the Mac.
export function fetchedAt(): string | null {
  try {
    return window.localStorage.getItem(SNAPSHOT_AT_KEY)
  } catch {
    // Storage is blocked (a private window, or site data refused): no stored time reads as never fetched.
    return null
  }
}

let refreshing: Promise<Fetched> | null = null

// Asks the Mac for a fresh copy, keeps it on the device and starts storing the voice. Callers at
// the same moment share one request.
export function refreshSnapshot(): Promise<Fetched> {
  if (!refreshing) {
    refreshing = fetchSnapshot()
      .then((result) => {
        if (result && "snapshot" in result) {
          writeSnapshot(window.localStorage, result.snapshot)
          try {
            window.localStorage.setItem(SNAPSHOT_AT_KEY, new Date().toISOString())
          } catch {
            // Storage full: the copy is current; only its date is missing.
          }
          void storeVoice(result.snapshot.voice)
        }
        window.dispatchEvent(new CustomEvent<Fetched>(REFRESHED, { detail: result }))
        return result
      })
      .finally(() => {
        refreshing = null
      })
  }
  return refreshing
}

// In the layout: whichever page the app opens on, the questions and the voice come to the device.
// Also when the app comes back to the screen: a home-screen app is often resumed, not reopened.
export function SnapshotPrefetch() {
  useEffect(() => {
    void refreshSnapshot()
    const visible = () => {
      if (document.visibilityState === "visible") void refreshSnapshot()
    }
    const shown = (event: PageTransitionEvent) => {
      if (event.persisted) void refreshSnapshot()
    }
    document.addEventListener("visibilitychange", visible)
    window.addEventListener("pageshow", shown)
    return () => {
      document.removeEventListener("visibilitychange", visible)
      window.removeEventListener("pageshow", shown)
    }
  }, [])
  return null
}

export function useSnapshot(): SnapshotState {
  const [state, setState] = useState<Omit<SnapshotState, "lines">>({ snapshot: null, from: "loading", broken: null })
  const [lines, setLines] = useState<ScoreLine[]>([])

  useEffect(() => {
    let live = true
    const apply = (result: Fetched) => {
      if (!live) return
      if (result && "snapshot" in result) {
        setState({ snapshot: result.snapshot, from: "mac", broken: null })
      } else {
        const kept = readSnapshot(window.localStorage)
        setState({ snapshot: kept, from: kept ? "device" : "none", broken: result && "broken" in result ? result.broken : null })
      }
    }
    const refreshed = (event: Event) => apply((event as CustomEvent<Fetched>).detail)
    window.addEventListener(REFRESHED, refreshed)
    void refreshSnapshot().then(apply)
    return () => {
      live = false
      window.removeEventListener(REFRESHED, refreshed)
    }
  }, [])

  useEffect(() => {
    const update = () => {
      // After a send, the kept copy holds the answers the Mac took; read it again.
      const kept = state.from === "loading" ? null : readSnapshot(window.localStorage)
      const base = kept ?? state.snapshot
      setLines(base ? mergeLines(base.lines, readOutbox(window.localStorage)) : [])
    }
    update()
    window.addEventListener(CHANGED, update)
    return () => window.removeEventListener(CHANGED, update)
  }, [state])

  return { ...state, lines }
}
