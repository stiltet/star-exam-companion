import type { ReactNode } from "react"

// The quiz's section-bar atom: the title bar over a bordered table, such as VOICE QUIZ
// on Progress. Its look lives here; the parent places it. It is the section's h2, under the
// page's h1, so it never goes inside another heading.
// dark: a section of results. muted: a section of guidance (SECTION BREAKDOWN, RECOMMENDED FOCUS).
// A title too long for a phone wraps into even lines, never one word left alone on the last.
export type SectionBarVariant = "dark" | "muted"

const VARIANTS: Record<SectionBarVariant, string> = {
  dark: "bg-foreground text-background",
  muted: "bg-muted",
}

export function SectionBar({ variant = "dark", children }: { variant?: SectionBarVariant; children: ReactNode }) {
  return <h2 className={`p-4 border-b border-foreground font-bold text-balance ${VARIANTS[variant]}`}>{children}</h2>
}
