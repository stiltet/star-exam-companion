import type { ReactNode } from "react"

// The quiz's text atom. tagline: the home page's quiet line under the title. On
// desktop it is larger, right-aligned and lower case (owner, 28 Oct); a phone keeps its look.
// muted: a quiet line of page text, such as the Practice Exam intro. note: a small quiet line
// under a table. notice: a boxed message that fills the place of content, such as "loading" or
// "nothing left"; give it role="status", or "alert" for an error, so a screen reader announces
// it. Its look lives here; the parent places it.
export type TextVariant = "tagline" | "muted" | "note" | "notice"

const LOOK: Record<TextVariant, string> = {
  muted: "text-muted-foreground m-0",
  note: "text-sm text-muted-foreground m-0",
  notice: "border-2 border-foreground p-6 text-center text-muted-foreground m-0",
  tagline: "text-muted-foreground m-0 lg:text-2xl lg:text-right lg:lowercase",
}

export function Text({
  variant,
  placement,
  role,
  children,
}: {
  variant: TextVariant
  placement?: string
  role?: "status" | "alert"
  children: ReactNode
}) {
  return (
    <p role={role} className={[LOOK[variant], placement].filter(Boolean).join(" ")}>
      {children}
    </p>
  )
}
