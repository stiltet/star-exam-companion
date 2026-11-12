"use client"

import { useEffect, useState } from "react"
import { currentExam } from "@/lib/scope"
import { voiceCleanup, type VoiceLists } from "@/lib/voice-lists"

// Kept by the service worker across builds; it plays these clips with no connection.
const VOICE_CACHE = "quiz-voice"
const STORED = "quiz-voice-stored"
// The clips each exam last stored, so one exam's clean-up never deletes a clip another exam still uses, and a clip
// stored before this list existed is never deleted by it.
const LISTS_KEY = "quiz-voice-lists"

function readLists(): VoiceLists {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(LISTS_KEY) ?? "{}")
    return value && typeof value === "object" && !Array.isArray(value) ? (value as VoiceLists) : {}
  } catch {
    // Storage blocked or unreadable: no lists, so nothing is deleted.
    return {}
  }
}
// After a failed clip (the Mac restarting, a dropped request), how long until storing tries again.
const RETRY_MS = 30_000

let storing: Promise<void> | null = null
let retry: ReturnType<typeof setTimeout> | null = null

// Set when the exam is being switched: the clips still to store belong to the exam being left, so storing stops.
let stopped = false

export function stopStoringVoice(): void {
  stopped = true
}

// A clip from the voice cache on this device if it is there, else from the Mac. Read by the page
// itself, not through the service worker, which left the voice silent in the home-screen app.
export async function loadClip(url: string): Promise<Blob> {
  if ("caches" in window) {
    const kept = await (await caches.open(VOICE_CACHE)).match(url)
    if (kept) return kept.blob()
  }
  const response = await fetch(url)
  if (!response.ok) throw new Error(`the Mac answered ${response.status}`)
  return response.blob()
}

// Stores the Mac's voice for every line the quiz can say, one clip at a time so the Mac runs one
// `say` for this. Stops at the first failure and tries again after RETRY_MS while the app is on
// screen, on any page; a hidden app carries on when it comes back (SnapshotPrefetch). Drops clips
// this exam stored and no exam uses any more. Needs HTTPS (or localhost), as the Cache API does.
export function storeVoice(voice: Record<string, string>): Promise<void> {
  if (storing || typeof window === "undefined" || !("caches" in window)) return storing ?? Promise.resolve()
  if (retry) clearTimeout(retry)
  retry = null
  let failed = false
  const storeAll = async () => {
    const cache = await caches.open(VOICE_CACHE)
    const wanted = new Set(Object.values(voice).map((key) => `/api/speak/${key}`))
    const cached = (await cache.keys()).map((request) => new URL(request.url).pathname)
    const { lists, remove } = voiceCleanup(cached, readLists(), currentExam(), [...wanted])
    for (const request of await cache.keys()) {
      if (remove.includes(new URL(request.url).pathname)) await cache.delete(request)
    }
    try {
      window.localStorage.setItem(LISTS_KEY, JSON.stringify(lists))
    } catch {
      // Storage full or blocked: the next run deletes nothing it cannot account for.
    }
    for (const url of wanted) {
      if (stopped) break
      if (await cache.match(url)) continue
      try {
        const response = await fetch(url)
        if (!response.ok) {
          failed = true
          break
        }
        await cache.put(url, response)
        window.dispatchEvent(new Event(STORED))
      } catch {
        // Offline or the Mac is asleep: try again shortly, or at the next visit at home.
        failed = true
        break
      }
    }
  }
  storing = storeAll().catch(() => {
    // A browser refuses storage calls while the page is unloading, as WebKit does with "Context is stopped", which
    // happens when the exam is switched mid-download. It is not an error to report: storing resumes on the next page.
    failed = true
  }).finally(() => {
    storing = null
    if (failed) {
      retry = setTimeout(() => {
        retry = null
        if (document.visibilityState === "visible") void storeVoice(voice)
      }, RETRY_MS)
    }
  })
  return storing
}

// How many of the quiz's lines are on this device, and how many there are.
// The last count, kept in memory, so the Offline / connection status panel, which is built afresh each time it
// opens, shows the previous count at once and refreshes it quietly instead of starting empty.
let lastCount: { stored: number; total: number } | null = null

export function useVoiceStored(voice: Record<string, string> | undefined): { stored: number; total: number } | null {
  const [count, setCount] = useState<{ stored: number; total: number } | null>(lastCount)
  useEffect(() => {
    if (!voice || !("caches" in window)) return
    const wanted = new Set(Object.values(voice).map((key) => `/api/speak/${key}`))
    let live = true
    const update = async () => {
      const cache = await caches.open(VOICE_CACHE)
      const stored = (await cache.keys()).filter((request) => wanted.has(new URL(request.url).pathname)).length
      lastCount = { stored, total: wanted.size }
      if (live) setCount(lastCount)
    }
    void update()
    window.addEventListener(STORED, update)
    return () => {
      live = false
      window.removeEventListener(STORED, update)
    }
  }, [voice])
  return count
}
