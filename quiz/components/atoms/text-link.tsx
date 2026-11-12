import type { ReactNode } from "react"

// The quiz's link inside a line of text, such as a name that links to a profile. It is underlined and bold so it reads as a link in
// running text, and it opens in a new tab with no opener, so it is for addresses outside the app. Like the action link it shows a ↗
// and says to a screen reader that it opens a new tab. Its look lives here; the parent places it.
export function TextLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="underline font-bold">
      {children}
      <span aria-hidden="true">↗</span>
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  )
}
