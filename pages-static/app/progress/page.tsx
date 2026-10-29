import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { LocalOnlyPanel } from "@/components/local-only-panel"

// The online demo's Progress page. scripts/build-pages.sh copies this over quiz/app/progress in a
// temporary build copy; the real page is never changed.
export default function ProgressPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 max-w-4xl mx-auto px-4 py-8 w-full">
        <LocalOnlyPanel
          feature="Progress"
          what="keeps your results from every device you study on in a file on your own computer"
        />
      </main>
      <SiteFooter />
    </div>
  )
}
