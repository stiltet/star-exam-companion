"use client"

import { useEffect, useState } from "react"
import { useTheme } from "next-themes"
import { ActionButton } from "@/components/atoms/button"

// The footer's theme button: Auto (the device's setting), Light, Dark, then Auto again. The choice
// is kept on this device only.
const NEXT: Record<string, string> = { system: "light", light: "dark", dark: "system" }
const LABEL: Record<string, string> = { system: "Auto", light: "Light", dark: "Dark" }

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  // The stored choice is known only in the browser; until then the button says Auto.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const current = mounted && theme && LABEL[theme] ? theme : "system"
  return (
    <ActionButton variant="toggle" onClick={() => setTheme(NEXT[current] ?? "system")} aria-label={`Theme: ${LABEL[current]}. Change to ${LABEL[NEXT[current] ?? "system"]}`}>
      ◐ Theme: {LABEL[current]}
    </ActionButton>
  )
}
