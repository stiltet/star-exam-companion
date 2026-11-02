"use client"

import { useEffect, useState } from "react"
import { currentExam } from "@/lib/scope"

// Kept by the service worker across builds; it plays these clips with no connection.
const VOICE_CACHE = "quiz-voice"
const STORED = "quiz-voice-stored"
// The clips each exam last stored, so one exam's clean-up never deletes a clip another exam still uses, and a clip
// stored before this list existed is never deleted by it.
const LISTS_KEY = "quiz-voice-lists"

function readLists(): Record<string, string[]> {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(LISTS_KEY) ?? "{}")
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, string[]>) : {}
  } catch {
    // Storage blocked or unreadable: no lists, so nothing is deleted.
    return {}
  }
}
// After a failed clip (the Mac restarting, a dropped request), how long until storing tries again.
const RETRY_MS = 30_000

let storing: Promise<void> | null = null
let retry: ReturnType<typeof setTimeout> | null = null

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
  storing = (async () => {
    const cache = await caches.open(VOICE_CACHE)
    const wanted = new Set(Object.values(voice).map((key) => `/api/speak/${key}`))
    const lists = readLists()
    const previous = new Set(lists[currentExam()] ?? [])
    lists[currentExam()] = [...wanted]
    const stillUsed = new Set(Object.values(lists).flat())
    for (const request of await cache.keys()) {
      const clip = new URL(request.url).pathname
      if (previous.has(clip) && !stillUsed.has(clip)) await cache.delete(request)
    }
    try {
      window.localStorage.setItem(LISTS_KEY, JSON.stringify(lists))
    } catch {
      // Storage full or blocked: the next run deletes nothing it cannot account for.
    }
    for (const url of wanted) {
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
  })().finally(() => {
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
export function useVoiceStored(voice: Record<string, string> | undefined): { stored: number; total: number } | null {
  const [count, setCount] = useState<{ stored: number; total: number } | null>(null)
  useEffect(() => {
    if (!voice || !("caches" in window)) return
    const wanted = new Set(Object.values(voice).map((key) => `/api/speak/${key}`))
    let live = true
    const update = async () => {
      const cache = await caches.open(VOICE_CACHE)
      const stored = (await cache.keys()).filter((request) => wanted.has(new URL(request.url).pathname)).length
      if (live) setCount({ stored, total: wanted.size })
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
