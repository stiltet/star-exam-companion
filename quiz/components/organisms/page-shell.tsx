import type { ReactNode } from "react"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import type { Crumb } from "@/components/atoms/breadcrumb"
import { CrumbBar, CrumbProvider, SubBar } from "@/components/crumb-slot"
import { StackHeight } from "@/components/stack-height"

// The one layout of every page (owner, 17 Nov): header, menu and breadcrumb fixed to the top on every width, then the page, then
// the footer. A page gives its content and its trail, never its own header, width or padding. Variants: "centered" (404), "fill"
// (the voice quiz, flush footer) and "reading" (Read Aloud pages, less room above the first line).
export function PageShell({ breadcrumb, variant = "default", children }: { breadcrumb?: Omit<Crumb, "onClick">[]; variant?: "default" | "centered" | "fill" | "reading"; children: ReactNode }) {
  const main = {
    default: "py-8",
    centered: "py-8 flex flex-col items-center justify-center",
    fill: "flex flex-col pt-4 sm:pt-8 pb-6",
    reading: "pt-4 pb-6",
  }[variant]
  return (
    <CrumbProvider key={JSON.stringify(breadcrumb ?? null)} initial={breadcrumb}>
    <div className="min-h-screen flex flex-col">
      {/* One fixed stack: other fixed things (the Read Aloud control bar) read its height from data-sticky-stack. */}
      <StackHeight />
      <div data-sticky-stack className="sticky top-0 z-40 w-full bg-background">
        <SiteHeader />
        <CrumbBar />
        <SubBar />
      </div>
      <main className={`flex-1 max-w-4xl mx-auto px-4 w-full ${main}`}>{children}</main>
      <SiteFooter flush={variant === "fill"} />
    </div>
    </CrumbProvider>
  )
}
