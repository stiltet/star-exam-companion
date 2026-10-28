"use client"

import { useEffect } from "react"

// A silent WAV, played inside the first tap so later clips may play without a tap.
export const SILENCE = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA="

let audio: HTMLAudioElement | null = null

// One audio element for the whole app. iOS lets a page play sound only on an element a tap
// has already started, so the Voice Quiz reuses the one the first tap unlocked.
export function sharedAudio(): HTMLAudioElement {
  if (!audio) audio = new Audio()
  return audio
}

// In the layout: the first tap anywhere, such as the one on the Voice Quiz link, unlocks the
// element, so the question is read aloud when the page opens.
export function AudioUnlock() {
  useEffect(() => {
    const unlock = () => {
      const element = sharedAudio()
      if (!element.src) {
        element.src = SILENCE
        void element.play().catch(() => undefined)
      }
      window.removeEventListener("pointerdown", unlock, true)
      window.removeEventListener("touchend", unlock, true)
    }
    window.addEventListener("pointerdown", unlock, true)
    window.addEventListener("touchend", unlock, true)
    return () => {
      window.removeEventListener("pointerdown", unlock, true)
      window.removeEventListener("touchend", unlock, true)
    }
  }, [])
  return null
}
