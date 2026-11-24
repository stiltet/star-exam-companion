"use client"

import { useLayoutEffect } from "react"

// Tells the page how tall the fixed stack (header and breadcrumb) is, as --stack-height on <html>, so an #anchor link scrolls below it.
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
