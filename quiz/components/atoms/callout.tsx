import { useId, type ReactNode } from "react"
import { Heading } from "./heading"

// The quiz's callout atom: a boxed tip that floats over the bottom of the page, such as the one that
// offers the home-screen install. Its look lives here; the parent decides when it shows. It keeps
// clear of the phone's home bar. title: its heading line, written in capitals like the other label
// headings. pointer: a ▼ under the box, for a tip that points at a control of the browser below it.
export function Callout({ title, pointer = false, children }: { title: string; pointer?: boolean; children: ReactNode }) {
  const titleId = useId()
  return (
    <aside
      aria-labelledby={titleId}
      className="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-md flex-col gap-3 border-2 border-foreground bg-background p-4 shadow-lg"
      style={{ marginBottom: "env(safe-area-inset-bottom)" }}
    >
      <Heading variant="label" id={titleId}>{title}</Heading>
      {children}
      {pointer && <span aria-hidden="true" className="self-center text-2xl leading-none">▼</span>}
    </aside>
  )
}
