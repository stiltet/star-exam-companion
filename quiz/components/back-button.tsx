"use client"

import { useEffect, useRef } from "react"
import { usePathname, useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { parentPath } from "@/lib/parent-path"
import { cameFromApp, ENTRY_STATE_KEY, entryKey, LAST_ENTRY_KEY, parseEntry, serialiseEntry, type Entry } from "@/lib/scroll-memory"
import { readStandalone, useStandalone } from "@/components/standalone"

// A round Back button floating at the bottom left, only in the installed app, which has no browser
// back button. In a browser tab the browser's own back is there, so this one is not shown.
//
// It behaves like a normal back button: it returns to the page just before, at the scroll that page
// was left at. Every history entry (a path visited twice is two) is stamped with an id in
// history.state, which survives a reload, and keeps a record in sessionStorage: the entry it was
// opened from, and its scroll, saved as the page scrolls. So the scroll is never saved at the moment
// of a move, when the browser may already have changed it, and a reload forgets nothing. Back goes
// back in history when the entry knows the one before it; an entry opened directly, or by going up
// a level, has none, and Back goes up a level instead. One restorer puts the scroll back: the
// browser's own is switched off in the installed app.

function readEntry(id: string): Entry | null {
  try {
    return parseEntry(window.sessionStorage.getItem(entryKey(id)))
  } catch {
    // Without storage Back goes up a level, and a page opens at the top.
    return null
  }
}

function writeEntry(id: string, entry: Entry) {
  try {
    window.sessionStorage.setItem(entryKey(id), serialiseEntry(entry))
  } catch {
    // Without storage the page simply opens at the top.
  }
}

const stateId = (): string | null => {
  const id: unknown = (window.history.state as Record<string, unknown> | null)?.[ENTRY_STATE_KEY]
  return typeof id === "string" ? id : null
}

function rememberLast(id: string) {
  try {
    window.sessionStorage.setItem(LAST_ENTRY_KEY, id)
  } catch {
    // Without storage a page loaded in full cannot name the one before it.
  }
}

// crypto.randomUUID needs a secure context, and the quiz is also served over plain http on the LAN.
const newId = (): string => (typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`)

export function BackButton() {
  const pathname = usePathname()
  const router = useRouter()
  // The entry the page is on, and whether the next new entry is a move up a level (it has no entry before it).
  const current = useRef<string | null>(null)
  const goingUp = useRef(false)
  // True while the restorer holds the scroll, so a scroll it causes, or the page growing, is not saved.
  const holding = useRef(false)
  const restoring = useRef(0)
  // A tap on Back is not answered again until the move it made has happened.
  const tapped = useRef(false)
  const standalone = useStandalone()

  // Names the entry the page is on. One without an id is new: a move forward by a link or the router,
  // whose state Next.js just wrote. It is stamped, and remembers the entry it came from.
  const sync = (): string | null => {
    if (!readStandalone()) return null
    const known = stateId()
    if (known) {
      current.current = known
      rememberLast(known)
      return known
    }
    // An entry Next.js did not write (a plain #anchor link, which the browser handles itself) has no
    // __NA marker. Stamping it would leave a state Next.js answers with a full page reload on the next
    // Back or Forward over it, so it is left alone: Back from it goes up a level.
    if ((window.history.state as { __NA?: boolean } | null)?.__NA !== true) return null
    const id = newId()
    // After a page load in full there is no entry in memory, but the page it came from was the last one named.
    let before = current.current
    if (before === null && cameFromApp(document.referrer, window.location.origin)) {
      try {
        before = window.sessionStorage.getItem(LAST_ENTRY_KEY)
      } catch {
        // Without storage Back goes up a level.
      }
    }
    writeEntry(id, { prev: goingUp.current ? null : before, scroll: 0 })
    goingUp.current = false
    window.history.replaceState({ ...(window.history.state as object | null), [ENTRY_STATE_KEY]: id }, "")
    current.current = id
    rememberLast(id)
    return id
  }

  const save = () => {
    const id = sync()
    if (!id || holding.current) return
    const entry = readEntry(id) ?? { prev: null, scroll: 0 }
    writeEntry(id, { ...entry, scroll: Math.max(0, Math.round(window.scrollY)) })
  }

  const restore = (target: number) => {
    const token = ++restoring.current
    holding.current = true
    let frames = 0
    let held = 0
    let interrupted = false
    const interrupt = () => { interrupted = true }
    const finish = () => {
      window.removeEventListener("wheel", interrupt)
      window.removeEventListener("touchstart", interrupt)
      window.removeEventListener("pointerdown", interrupt)
      window.removeEventListener("keydown", interrupt)
      if (token === restoring.current) holding.current = false
    }
    window.addEventListener("wheel", interrupt, { passive: true })
    window.addEventListener("touchstart", interrupt, { passive: true })
    window.addEventListener("pointerdown", interrupt)
    window.addEventListener("keydown", interrupt)
    const step = () => {
      if (token !== restoring.current || interrupted) {
        finish()
        return
      }
      // The page may fill in after it opens (Progress does): wait until it is tall enough.
      const tall = document.documentElement.scrollHeight - window.innerHeight >= target
      if (tall || frames > 180) {
        window.scrollTo(0, target)
        if (++held > 30) {
          finish()
          return
        }
      } else frames++
      window.requestAnimationFrame(step)
    }
    step()
  }

  useEffect(() => {
    if (readStandalone()) {
      // One restorer: this one. The browser's own would race it.
      window.history.scrollRestoration = "manual"
      const id = sync()
      const navigation = window.performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined
      if (id && (navigation?.type === "reload" || navigation?.type === "back_forward")) {
        const entry = readEntry(id)
        if (entry) restore(entry.scroll)
      }
    }
    // Saved when the scroll rests, not on every frame: a click, a page hide and a move away also save.
    let rest = 0
    const onScroll = () => {
      window.clearTimeout(rest)
      rest = window.setTimeout(save, 150)
    }
    const onPop = () => {
      if (!readStandalone()) return
      tapped.current = false
      const id = sync()
      const entry = id ? readEntry(id) : null
      if (entry) restore(entry.scroll)
    }
    const onHide = () => {
      if (document.visibilityState === "hidden") save()
    }
    window.addEventListener("scroll", onScroll, { passive: true })
    document.addEventListener("click", save, true)
    window.addEventListener("popstate", onPop)
    window.addEventListener("pagehide", save)
    document.addEventListener("visibilitychange", onHide)
    return () => {
      window.clearTimeout(rest)
      window.removeEventListener("scroll", onScroll)
      document.removeEventListener("click", save, true)
      window.removeEventListener("popstate", onPop)
      window.removeEventListener("pagehide", save)
      document.removeEventListener("visibilitychange", onHide)
    }
    // Keep listeners stable and check display mode when they run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // A page was reached: name its entry. Next.js writes the history entry after this effect, so wait a tick.
  useEffect(() => {
    tapped.current = false
    const timer = window.setTimeout(sync, 0)
    return () => window.clearTimeout(timer)
  }, [pathname, standalone])

  const up = parentPath(pathname)
  if (up === null || !standalone) return null

  return (
    <button
      type="button"
      aria-label="Back"
      onClick={() => {
        // A double tap is one Back, not two.
        if (tapped.current) return
        tapped.current = true
        // Cleared when the page it moved to is reached (the pathname effect) or on popstate. This is only a
        // safety net for a move that never happens, and is long enough for a slow push.
        window.setTimeout(() => { tapped.current = false }, 5000)
        const id = sync()
        const entry = id ? readEntry(id) : null
        if (entry?.prev) return router.back()
        // Going up is not a move back through history: the page it opens counts as opened directly,
        // so the next Back goes up again instead of bouncing between the two pages.
        // The flag is read, and cleared, by sync when the new page is reached, however long the push takes.
        goingUp.current = true
        router.push(up)
      }}
      className="round-float fixed bottom-8 left-8 z-50 flex size-11 items-center justify-center bg-black text-white shadow-lg ring-1 ring-white/20 active:scale-95"
    >
      <ArrowLeft aria-hidden="true" className="size-5" />
    </button>
  )
}
