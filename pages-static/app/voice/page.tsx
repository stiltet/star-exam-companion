import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { LocalOnlyPanel } from "@/components/local-only-panel"

// The online demo's Voice Quiz page. scripts/build-pages.sh copies this over quiz/app/voice in a
// temporary build copy; the real page is never changed.
export default function VoicePage() {
  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 max-w-4xl mx-auto px-4 py-8 w-full">
        <LocalOnlyPanel
          feature="Voice Quiz"
          voice
          what="reads each exam scene and its options aloud in your computer's voice and keeps asking until you have learned every term"
        />
      </main>
      <SiteFooter />
    </div>
  )
}
