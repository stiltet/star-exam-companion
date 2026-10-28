"use client"

import { useEffect } from "react"

// The Next.js development badge lives in a shadow root that page CSS cannot reach, and its grey is
// a hard-coded rgba(0,0,0,0.8). This adds one CSS override inside that root so the badge is solid
// black, like the Back button. Development only: a production build has no badge.
const OVERRIDE = "[data-next-badge] { background: #000 !important; }"

export function DevBadgeStyle() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return
    const apply = () => {
      const root = document.querySelector("nextjs-portal")?.shadowRoot
      if (!root || root.querySelector("style[data-dev-badge-style]")) return
      const style = document.createElement("style")
      style.setAttribute("data-dev-badge-style", "")
      style.textContent = OVERRIDE
      root.appendChild(style)
    }
    apply()
    // The badge can mount after this page, or again after a reload of the dev overlay.
    const observer = new MutationObserver(apply)
    observer.observe(document.body, { childList: true })
    return () => observer.disconnect()
  }, [])
  return null
}
