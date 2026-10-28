import type { ReactNode } from "react"

// The quiz's text atom. tagline: the home page's quiet line under the title. On
// desktop it is larger, right-aligned and lower case (owner, 28 Oct); a phone keeps its look.
// muted: a quiet line of page text, such as the Practice Exam intro. note: a small quiet line
// under a table. Its look lives here; the parent places it.
export type TextVariant = "tagline" | "muted" | "note"

const LOOK: Record<TextVariant, string> = {
  muted: "text-muted-foreground m-0",
  note: "text-sm text-muted-foreground m-0",
  tagline: "text-muted-foreground m-0 lg:text-2xl lg:text-right lg:lowercase",
}

export function Text({ variant, placement, children }: { variant: TextVariant; placement?: string; children: ReactNode }) {
  return <p className={[LOOK[variant], placement].filter(Boolean).join(" ")}>{children}</p>
}
