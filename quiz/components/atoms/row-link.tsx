import Link from "next/link"
import type { ReactNode } from "react"

// A bold link at the end of a table row, such as Review → on Progress. The router's Link, so the
// move stays inside the app and the Back button can go back through history. Its look lives here;
// the table cell places it.
export function RowLink({ href, children }: { href: string; children: ReactNode }) {
  return <Link href={href} className="font-bold">{children}</Link>
}
