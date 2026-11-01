"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { ActionButton } from "@/components/atoms/button"
import { Callout } from "@/components/atoms/callout"
import { Text } from "@/components/atoms/text"
import { useStandalone } from "@/components/standalone"
import { detectPlatform, shouldOffer, showDelay, type InstallPlatform } from "@/lib/install-hint"

// The browser's own install prompt, which Chromium hands over once and lets a page keep.
type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> }

const DISMISSED = "quiz-install-dismissed"
const INSTALLED = "quiz-install-done"
const VISITS = "quiz-install-visits"
const COUNTED = "quiz-install-counted"

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    // Storage is blocked (private window): treat it as empty, so the hint can still show once.
    return null
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Private windows and blocked storage: the hint just comes back next time.
  }
}

// Offers to add the quiz to the home screen on a phone or tablet. Android gets an Install button;
// iOS has no such call, so it gets the Share steps. Never shown in the installed app or on desktop.
// It also works in the online demo, which is why it lives in the root layout.
export function InstallHint() {
  const standalone = useStandalone()
  const pathname = usePathname()
  const [platform, setPlatform] = useState<InstallPlatform>("other")
  const [ipad, setIpad] = useState(false)
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null)
  const [visible, setVisible] = useState(false)
  const [closed, setClosed] = useState(false)

  useEffect(() => {
    const ua = navigator.userAgent
    const found = detectPlatform(ua, navigator.maxTouchPoints)
    setPlatform(found)
    setIpad(/iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1))
    if (found === "other") return

    // A visit is a browsing session, not a page load: sessionStorage marks this one as counted.
    let visits = Number(read(VISITS) ?? "0")
    try {
      if (!sessionStorage.getItem(COUNTED)) {
        sessionStorage.setItem(COUNTED, "1")
        visits += 1
        write(VISITS, String(visits))
      }
    } catch {
      // Blocked: this load counts as the first visit.
    }

    const onPrompt = (event: Event) => {
      event.preventDefault()
      setPrompt(event as InstallPromptEvent)
    }
    const onInstalled = () => {
      write(INSTALLED, "1")
      setPrompt(null)
      setClosed(true)
    }
    window.addEventListener("beforeinstallprompt", onPrompt)
    window.addEventListener("appinstalled", onInstalled)
    const timer = setTimeout(() => setVisible(true), showDelay(visits))
    return () => {
      clearTimeout(timer)
      window.removeEventListener("beforeinstallprompt", onPrompt)
      window.removeEventListener("appinstalled", onInstalled)
    }
  }, [])

  const dismissedAt = Number(read(DISMISSED)) || null
  // Never over a quiz in progress: the exam and the Voice Quiz keep their controls at the bottom.
  const quiet = pathname.startsWith("/exam") || pathname.startsWith("/voice")
  const offer = visible && !closed && !quiet && shouldOffer({
    platform,
    standalone,
    installed: read(INSTALLED) === "1",
    canPrompt: prompt !== null,
    dismissedAt,
    now: Date.now(),
  })
  if (!offer) return null

  const close = () => {
    write(DISMISSED, String(Date.now()))
    setClosed(true)
  }

  const install = async () => {
    if (!prompt) return
    try {
      await prompt.prompt()
      const { outcome } = await prompt.userChoice
      if (outcome === "accepted") {
        write(INSTALLED, "1")
        setClosed(true)
      }
    } catch {
      // The browser refused a second use of the prompt; the finally below drops it.
    } finally {
      // A prompt works once; Android then waits for the browser to hand over another.
      setPrompt(null)
    }
  }

  return (
    <Callout title="Keep it on your home screen" pointer={platform === "ios-safari" && !ipad}>
      {platform === "android" && <Text variant="muted">Opens full screen, like an app, and works offline.</Text>}
      {platform === "ios-safari" && (
        <Text variant="muted">Tap Share {ipad ? "in the toolbar" : "below"} (□↑), then Add to Home Screen.</Text>
      )}
      {platform === "ios-other" && <Text variant="muted">Open this page in Safari, tap Share, then Add to Home Screen.</Text>}
      <div className="flex gap-3">
        {platform === "android" && <ActionButton variant="filled" onClick={install}>Install</ActionButton>}
        <ActionButton variant="outlined" onClick={close}>Not now</ActionButton>
      </div>
    </Callout>
  )
}
