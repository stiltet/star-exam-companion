import type { ReactNode } from "react"

// The quiz's badge atom: a short status word beside a title, such as RIGHT or FLAGGED
// on an exam review card. Its look lives here; the parent places it.
export type BadgeVariant = "right" | "wrong" | "unanswered" | "flag" | "plain"

const LOOK: Record<BadgeVariant, string> = {
  right: "border-correct text-correct",
  wrong: "border-incorrect text-incorrect",
  unanswered: "border-foreground text-muted-foreground",
  flag: "border-flag bg-flag text-flag-foreground",
  plain: "border-foreground text-foreground",
}

export function Badge({ variant, children }: { variant: BadgeVariant; children: ReactNode }) {
  return <span className={`inline-block border-2 px-2 py-0.5 text-xs font-bold uppercase whitespace-nowrap ${LOOK[variant]}`}>{children}</span>
}
