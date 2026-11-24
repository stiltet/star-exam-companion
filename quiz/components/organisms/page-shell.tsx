import type { ReactNode } from "react"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import type { Crumb } from "@/components/atoms/breadcrumb"
import { CrumbBar, CrumbProvider } from "@/components/crumb-slot"
import { StackHeight } from "@/components/stack-height"

// The one layout of every page (owner, 17 Nov): the header and menu, then the breadcrumb where the page has one, both
// fixed to the top while the page scrolls, on a phone and on a desktop alike; then the page; then the footer. A page
// never builds its own header, container width, side padding or breadcrumb: it gives its content, and its trail.
// variant "centered": the content sits in the middle (404). "fill": the content fills the screen, with less room above
// it and a footer that sits flush (the voice quiz). "reading": the Read Aloud course and lesson pages, whose first line is
// the Previous and Next pair right under the breadcrumb, so less room above it.
export function PageShell({ breadcrumb, variant = "default", children }: { breadcrumb?: Crumb[]; variant?: "default" | "centered" | "fill" | "reading"; children: ReactNode }) {
  const main = {
    default: "py-8",
    centered: "py-8 flex flex-col items-center justify-center",
    fill: "flex flex-col pt-4 sm:pt-8 pb-6",
    reading: "pt-4 pb-6",
  }[variant]
  return (
    <CrumbProvider initial={breadcrumb}>
    <div className="min-h-screen flex flex-col">
      {/* One fixed stack: other fixed things (the Read Aloud control bar) read its height from data-sticky-stack. */}
      <StackHeight />
      <div data-sticky-stack className="sticky top-0 z-40 w-full bg-background">
        <SiteHeader />
        <CrumbBar />
      </div>
      <main className={`flex-1 max-w-4xl mx-auto px-4 w-full ${main}`}>{children}</main>
      <SiteFooter flush={variant === "fill"} />
    </div>
    </CrumbProvider>
  )
}
