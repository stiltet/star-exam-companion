"use client"

import { useEffect, useState } from "react"
import { isStandalone } from "@/lib/standalone"

function readStandalone(): boolean {
  return isStandalone({
    displayModeStandalone: window.matchMedia("(display-mode: standalone)").matches,
    iosStandalone: (navigator as Navigator & { standalone?: boolean }).standalone,
  })
}

// True only in the installed app. It also marks <html data-standalone>, so CSS can keep room
// for the floating Back button there and nowhere else.
export function useStandalone(): boolean {
  const [standalone, setStandalone] = useState(false)
  useEffect(() => {
    const query = window.matchMedia("(display-mode: standalone)")
    const update = () => {
      const now = readStandalone()
      setStandalone(now)
      if (now) document.documentElement.dataset.standalone = ""
      else delete document.documentElement.dataset.standalone
    }
    update()
    query.addEventListener("change", update)
    return () => query.removeEventListener("change", update)
  }, [])
  return standalone
}
