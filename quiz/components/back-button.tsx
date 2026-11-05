"use client"

import { useEffect, useRef } from "react"
import { usePathname, useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { parentPath } from "@/lib/parent-path"
import { useStandalone } from "@/components/standalone"

// A round Back button floating at the bottom left, only in the installed app, which has no browser
// back button. In a browser tab the browser's own back is there, so this one is not shown.
// After a move inside the app it goes back in history; on a page opened directly it goes up a level.
export function BackButton() {
  const pathname = usePathname()
  const router = useRouter()
  const firstPath = useRef(pathname)
  const movedInApp = useRef(false)
  const standalone = useStandalone()

  useEffect(() => {
    if (pathname !== firstPath.current) movedInApp.current = true
  }, [pathname])

  const up = parentPath(pathname)
  if (up === null || !standalone) return null

  return (
    <button
      type="button"
      aria-label="Back"
      onClick={() => {
        if (movedInApp.current) return router.back()
        // Going up is not a move back through history: the page it opens counts as opened directly,
        // so the next Back goes up again instead of bouncing between the two pages.
        firstPath.current = up
        router.push(up)
      }}
      className="round-float fixed bottom-8 left-8 z-50 flex size-11 items-center justify-center bg-black text-white shadow-lg ring-1 ring-white/20 active:scale-95"
    >
      <ArrowLeft aria-hidden="true" className="size-5" />
    </button>
  )
}
