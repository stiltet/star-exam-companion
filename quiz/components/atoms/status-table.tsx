import type { ReactNode } from "react"

// The atoms of the status panel's table (Offline / connection status): the table, a row, a row's label, its value cell and the figure in
// it, and the note under it. Their look (text size, row height, spacing, colour, weight) lives here; the panel places them.
// StatusTable: the table, text smaller on a phone. StatusRow: one row, ruled underneath unless it is the last. StatusLabel: the quiet
// first cell. StatusCell: the value cell, two columns wide; strong sets it right-aligned and bold, for a value with no button.
// StatusValue: a bold figure, and on a wider screen one width for every figure so the buttons beside them line up; nowrap keeps a short
// figure on one line and live has a screen reader announce a change. StatusNote: a ruled box under the table; StatusList: a bulleted list in it.

const CELL = "h-11 px-2 sm:px-3"

export function StatusTable({ children }: { children: ReactNode }) {
  return (
    <table className="w-full text-xs sm:text-sm sm:whitespace-nowrap">
      <tbody>{children}</tbody>
    </table>
  )
}

export function StatusRow({ last, children }: { last?: boolean; children: ReactNode }) {
  return <tr className={last ? undefined : "border-b border-foreground"}>{children}</tr>
}

export function StatusLabel({ children }: { children: ReactNode }) {
  return <td className={`${CELL} text-muted-foreground sm:w-full`}>{children}</td>
}

export function StatusCell({ strong, children }: { strong?: boolean; children: ReactNode }) {
  return (
    <td className={strong ? `${CELL} text-right font-bold` : CELL} colSpan={2}>
      {children}
    </td>
  )
}

export function StatusValue({ nowrap, live, children }: { nowrap?: boolean; live?: boolean; children: ReactNode }) {
  return (
    <span className={`font-bold sm:min-w-[11ch]${nowrap ? " whitespace-nowrap" : ""}`} aria-live={live ? "polite" : undefined}>
      {children}
    </span>
  )
}

export function StatusNote({ role, children }: { role?: "status"; children: ReactNode }) {
  return (
    <div role={role} className="p-3 border-t border-foreground text-sm">
      {children}
    </div>
  )
}

export function StatusList({ children }: { children: ReactNode }) {
  return <ul className="mt-2 list-disc pl-5">{children}</ul>
}
