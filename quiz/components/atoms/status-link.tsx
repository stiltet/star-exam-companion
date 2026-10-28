import Link from "next/link"
import type { ReactNode } from "react"

// A row or a card that opens a reading or a course. Its padding, hover and status
// colour live here. Done is pastel green, in progress yellow, with black text on both.
export type ReadState = "none" | "progress" | "done"

const STATE: Record<ReadState, string> = {
  none: "",
  progress: "bg-yellow-100 text-black",
  done: "bg-green-100 text-black",
}

const LAYOUT = {
  row: "flex gap-3 p-4",
  stack: "block p-4",
}

export function StatusLink({ href, state, layout, children }: { href: string; state: ReadState; layout: keyof typeof LAYOUT; children: ReactNode }) {
  return (
    <Link href={href} className={`${LAYOUT[layout]} no-underline hover:bg-foreground hover:text-background ${STATE[state]}`}>
      {children}
    </Link>
  )
}
