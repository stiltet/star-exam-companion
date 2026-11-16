import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { LocalOnlyPanel } from "@/components/local-only-panel"
import { Text } from "@/components/atoms/text"
import { activePack } from "@/lib/pack"

// The online demo's Read Aloud page. scripts/build-pages.sh copies this over quiz/app/read in a
// temporary build copy, and drops the course and night-reading routes; the real pages are untouched.
export default function ReadPage() {
  const { meta } = activePack()
  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 max-w-4xl mx-auto px-4 py-8 w-full">
        {meta.notice && <Text variant="notice" role="status" placement="mb-6">{meta.notice}</Text>}
        <LocalOnlyPanel
          feature="Read Aloud"
          voice
          what="reads Google's learning-path course text aloud in your computer's voice, fetched live from Google"
        />
      </main>
      <SiteFooter />
    </div>
  )
}
