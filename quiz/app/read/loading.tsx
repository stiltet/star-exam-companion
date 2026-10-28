import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"

// Shown while a course is fetched from Google, which can take several seconds the first time.
export default function ReadLoading() {
  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 max-w-4xl mx-auto px-4 py-8 w-full">
        <p role="status" className="text-lg">Loading the course text from Google…</p>
      </main>
      <SiteFooter />
    </div>
  )
}
