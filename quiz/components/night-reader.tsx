"use client"

import { useEffect, useRef, useState } from "react"
import { ActionButton } from "@/components/atoms/button"
import {
  chapterAt, clock, createNightWatch, nightCacheUrl, NIGHT_PLACE_KEY, offlineLine, parsePlace, placeRecord, readStore, replacedNightEntry,
  seekWhenReady, STATUS_TIMEOUT_MS, STORE_TIMEOUT_MS, storedMegabytes, storeProblem, StoreRefused,
  type NightChapter, type NightRemote,
} from "@/lib/night"
import { examHeaders, followWrongExam } from "@/lib/exam-header"
import { currentExam, DEFAULT_EXAM, scoped } from "@/lib/scope"
import { NIGHT_CACHE } from "@/lib/sw"

// No sleep timer, no volume change and no screen wake lock. The listener keeps the device awake,
// and one looping file keeps playing with the screen locked.

type Stored = { key: string; bytes: number; chapters: NightChapter[]; blob: Blob }

const wide = "self-stretch sm:self-start"

function readStored(): string | null {
  try {
    return window.localStorage.getItem(scoped(NIGHT_PLACE_KEY))
  } catch {
    // A private window keeps no place. The recording can still be stored for this visit.
    return null
  }
}

function writeStored(value: string) {
  try {
    window.localStorage.setItem(scoped(NIGHT_PLACE_KEY), value)
  } catch {
    // A private window keeps no place. Playback for this visit still works.
  }
}

export function NightReader() {
  const [remote, setRemote] = useState<NightRemote | null>(null)
  const [stored, setStored] = useState<Stored | null>(null)
  const [playing, setPlaying] = useState(false)
  const [at, setAt] = useState(0)
  const [storing, setStoring] = useState(false)
  const [received, setReceived] = useState(0)
  const [note, setNote] = useState<string | null>(null)
  const audio = useRef<HTMLAudioElement | null>(null)
  const storedRef = useRef<Stored | null>(null)
  const armed = useRef(false)
  const savedAt = useRef(0)
  const retryRef = useRef<() => void>(() => undefined)
  // Store goes away when the recording is kept, so focus moves to Play, which takes its place.
  const playButton = useRef<HTMLButtonElement | null>(null)
  const focusPlay = useRef(false)
  storedRef.current = stored

  function player(): HTMLAudioElement {
    if (!audio.current) {
      const element = new Audio()
      element.loop = true
      element.preload = "auto"
      audio.current = element
    }
    return audio.current
  }

  function keep(seconds: number) {
    const current = storedRef.current
    if (!current) return
    writeStored(placeRecord({ key: current.key, seconds, bytes: current.bytes, chapters: current.chapters }))
  }

  function jump(seconds: number) {
    const element = player()
    if (!storedRef.current || !element.src) return
    const limit = Number.isFinite(element.duration) && element.duration > 0 ? element.duration : Number.POSITIVE_INFINITY
    const next = Math.min(Math.max(seconds, 0), limit)
    seekWhenReady(element, next)
    setAt(next)
    keep(next)
  }

  function skip(offset: number) {
    jump(player().currentTime + offset)
  }

  function chapterBy(by: number) {
    const chapters = storedRef.current?.chapters ?? []
    if (chapters.length === 0) return
    const current = chapterAt(chapters, player().currentTime)
    const index = current ? chapters.indexOf(current) : 0
    const next = chapters[index + by]
    if (next) jump(next.start)
  }

  useEffect(() => {
    const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession
    if (session) session.type = "playback"
    const place = parsePlace(readStored())
    const exam = currentExam()
    let live = true
    if (place && "caches" in window) {
      void caches.open(NIGHT_CACHE).then(async (cache) => {
        const hit = await cache.match(nightCacheUrl(place.key, exam))
          ?? (exam === DEFAULT_EXAM ? await cache.match(`/api/night/audio/${place.key}`) : undefined)
        if (!live || !hit) return
        const blob = await hit.blob()
        setStored({ key: place.key, bytes: place.bytes || blob.size, chapters: place.chapters, blob })
      }).catch(() => {
        // No stored recording, or storage is blocked. The page still shows the Mac's progress.
      })
    }
    const watch = createNightWatch({
      status: async (retry) => {
        const response = await fetch(retry ? "/api/night?retry=1" : "/api/night", {
          cache: "no-store", signal: AbortSignal.timeout(STATUS_TIMEOUT_MS), headers: examHeaders(),
        })
        if (await followWrongExam(response)) throw new Error("The exam changed.")
        return response.json()
      },
      stored: () => storedRef.current !== null,
      show: setRemote,
      later: (run, ms) => window.setTimeout(run, ms),
      cancel: (handle) => window.clearTimeout(handle),
      now: () => Date.now(),
    })
    void watch.look(false)
    retryRef.current = () => void watch.look(true)
    return () => {
      live = false
      watch.stop()
      const element = audio.current
      if (!element) return
      element.pause()
      if (element.src.startsWith("blob:")) URL.revokeObjectURL(element.src)
    }
  }, [])

  useEffect(() => {
    if (!stored) return
    const element = player()
    const url = URL.createObjectURL(stored.blob)
    element.src = url
    element.loop = true
    armed.current = false
    const tick = () => {
      setAt(element.currentTime)
      const now = Date.now()
      if (now - savedAt.current > 5000) {
        savedAt.current = now
        keep(element.currentTime)
      }
      const chapter = chapterAt(stored.chapters, element.currentTime)
      if ("mediaSession" in navigator) {
        navigator.mediaSession.playbackState = element.paused ? "paused" : "playing"
        navigator.mediaSession.metadata = new MediaMetadata({
          title: chapter?.title ?? "Night reading",
          artist: chapter ? `Course ${chapter.courseId}. ${chapter.courseTitle}` : "Night reading",
          album: "Night reading",
        })
        if (Number.isFinite(element.duration) && element.duration > 0) {
          try {
            navigator.mediaSession.setPositionState({ duration: element.duration, playbackRate: element.playbackRate || 1, position: Math.min(element.currentTime, element.duration) })
          } catch {
            // This browser rejects a position update. The page's own clock still moves.
          }
        }
      }
    }
    element.addEventListener("timeupdate", tick)
    return () => {
      element.removeEventListener("timeupdate", tick)
      element.pause()
      URL.revokeObjectURL(url)
    }
  }, [stored])

  useEffect(() => {
    if (!("mediaSession" in navigator)) return
    const listen = (action: MediaSessionAction, handler: MediaSessionActionHandler) => {
      try {
        navigator.mediaSession.setActionHandler(action, handler)
      } catch {
        // This browser has no such lock-screen control. The buttons on the page still work.
      }
    }
    listen("play", () => play())
    listen("pause", () => pause())
    listen("seekbackward", (details) => skip(-(details.seekOffset ?? 30)))
    listen("seekforward", (details) => skip(details.seekOffset ?? 30))
    listen("seekto", (details) => {
      if (typeof details.seekTime === "number") jump(details.seekTime)
    })
    listen("previoustrack", () => chapterBy(-1))
    listen("nexttrack", () => chapterBy(1))
    return () => {
      for (const action of ["play", "pause", "seekbackward", "seekforward", "seekto", "previoustrack", "nexttrack"] as const) {
        try {
          navigator.mediaSession.setActionHandler(action, null)
        } catch {
          // Clearing a control the browser never offered is the same as it not being there.
        }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- runs when the listed values change, not on every render of the others
  }, [stored])

  function play() {
    const element = player()
    if (!element.src) return
    if (!armed.current) {
      armed.current = true
      const place = parsePlace(readStored())
      const resume = () => {
        if (place && place.key === storedRef.current?.key && place.seconds > 0) element.currentTime = place.seconds
      }
      if (element.readyState >= 1) resume()
      else element.addEventListener("loadedmetadata", resume, { once: true })
    }
    void element.play().then(() => {
      setPlaying(true)
      setNote(null)
    }).catch((error: unknown) => {
      setPlaying(false)
      setNote(error instanceof DOMException && error.name === "NotAllowedError" ? "This device refused to play. Tap Play again." : "The recording could not play.")
    })
  }

  function pause() {
    const element = player()
    element.pause()
    setPlaying(false)
    keep(element.currentTime)
  }

  async function store() {
    if (!remote || remote.state !== "ready" || storing) return
    const ready = remote
    setStoring(true)
    setNote(null)
    setReceived(0)
    try {
      try {
        await navigator.storage?.persist?.()
      } catch {
        // The browser refused a lasting store. The recording still goes into the cache.
      }
      const response = await fetch(`/api/night/audio/${ready.key}`, { cache: "no-store", signal: AbortSignal.timeout(STORE_TIMEOUT_MS), headers: examHeaders() })
      if (await followWrongExam(response)) throw new StoreRefused("The exam changed. Reopen Night reading for the current exam.")
      if (!response.ok || !response.body) throw new StoreRefused(`The Mac answered ${response.status}, so nothing was stored. Try again.`)
      const blob = await readStore(response.body, ready.bytes, setReceived)
      if (!("caches" in window)) throw new StoreRefused("This browser cannot store the recording.")
      const cache = await caches.open(NIGHT_CACHE)
      const exam = currentExam()
      const cacheUrl = nightCacheUrl(ready.key, exam)
      await cache.put(new Request(cacheUrl), new Response(blob.slice(), { headers: { "Content-Type": "audio/mp4", "Content-Length": String(blob.size) } }))
      for (const request of await cache.keys()) {
        if (replacedNightEntry(request.url, cacheUrl, exam, DEFAULT_EXAM)) await cache.delete(request)
      }
      const next = { key: ready.key, bytes: blob.size, chapters: ready.chapters, blob }
      writeStored(placeRecord({ key: next.key, seconds: 0, bytes: next.bytes, chapters: next.chapters }))
      player().pause()
      setPlaying(false)
      focusPlay.current = true
      setStored(next)
    } catch (error) {
      // The sentence is shown on the page, so the person storing the file sees it.
      setNote(storeProblem(error))
    } finally {
      setStoring(false)
    }
  }

  useEffect(() => {
    if (!stored || !focusPlay.current) return
    focusPlay.current = false
    playButton.current?.focus()
  }, [stored])

  const chapter = stored ? chapterAt(stored.chapters, at) : null
  const preparing = remote?.state === "building"
    ? remote.total > 0 ? `The Mac is preparing the recording: ${remote.done} of ${remote.total}.` : "The Mac is preparing the recording."
    : null

  return (
    <div className="flex flex-col gap-4">
      <p>Every course, in order, then the same again. It repeats until you pause it. Store it on this device first, so it keeps playing with the screen locked.</p>
      {preparing && <p role="status">{preparing}</p>}
      {remote?.state === "offline" && <p role={stored ? "status" : "alert"}>{offlineLine(remote, stored !== null)}</p>}
      {remote?.state === "failed" && <p role="alert">{remote.error}</p>}
      {storing && <p role="status">Storing the recording on this device.</p>}
      {note && <p role="alert">{note}</p>}
      <div className="flex flex-col gap-3">
        {(remote?.state === "failed" || remote?.state === "offline") && (
          <ActionButton variant="outlined" placement={wide} onClick={() => retryRef.current()}>Try again</ActionButton>
        )}
        {remote?.state === "ready" && !stored && (
          <ActionButton variant="outlined" placement={wide} aria-disabled={storing} onClick={() => void store()}>
            {storing ? `Storing ${storedMegabytes(received)}` : `Store on this device (${storedMegabytes(remote.bytes)})`}
          </ActionButton>
        )}
        {stored && (
          <>
            <ActionButton ref={playButton} variant="filled" placement={wide} onClick={() => (playing ? pause() : play())}>
              {playing ? "Pause" : "Play"}
            </ActionButton>
            <div className="grid grid-cols-2 gap-3">
              <ActionButton variant="outlined" placement="self-stretch" wrap onClick={() => skip(-30)}>Back 30 seconds</ActionButton>
              <ActionButton variant="outlined" placement="self-stretch" wrap onClick={() => skip(30)}>Forward 30 seconds</ActionButton>
              <ActionButton variant="outlined" placement="self-stretch" wrap onClick={() => chapterBy(-1)}>Previous chapter</ActionButton>
              <ActionButton variant="outlined" placement="self-stretch" wrap onClick={() => chapterBy(1)}>Next chapter</ActionButton>
            </div>
          </>
        )}
      </div>
      {stored && (
        <p>
          {/* Only the chapter is live, so a screen reader speaks a new chapter, not every second. */}
          <span role="status">{chapter ? `Course ${chapter.courseId}. ${chapter.courseTitle}. Reading ${chapter.number}. ${chapter.title}.` : "Night reading."}</span> {clock(at)}
          {stored.bytes > 0 ? ` On this device: ${storedMegabytes(stored.bytes)}.` : ""}
        </p>
      )}
    </div>
  )
}
