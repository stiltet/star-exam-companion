"use client"

import { useLayoutEffect } from "react"

// Tells the page how tall the fixed stack (header and breadcrumb) is, as --stack-height on <html>, so a link to
// an #anchor scrolls the target to just below the stack and not under it (globals.css reads it as scroll-padding-top).
export function StackHeight() {
  useLayoutEffect(() => {
    const stack = document.querySelector("[data-sticky-stack]")
    if (!(stack instanceof HTMLElement)) return
    const root = document.documentElement
    const apply = () => root.style.setProperty("--stack-height", `${Math.round(stack.getBoundingClientRect().height)}px`)
    apply()
    const observer = new ResizeObserver(apply)
    observer.observe(stack)
    return () => {
      observer.disconnect()
      root.style.removeProperty("--stack-height")
    }
  }, [])
  return null
}
