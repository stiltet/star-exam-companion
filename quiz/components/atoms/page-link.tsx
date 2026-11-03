import type { ReactNode } from "react"

// A small link in a row of links, such as the online demo's exam choice. The current one is bold.
// A plain anchor, not the router's Link: each target is its own copy of the demo. Its look lives
// here; the parent places it.
export function PageLink({ href, current, children }: { href: string; current: boolean; children: ReactNode }) {
  return (
    <a href={href} aria-current={current ? "page" : undefined} className={`text-sm ${current ? "font-bold" : ""}`}>
      {children}
    </a>
  )
}
