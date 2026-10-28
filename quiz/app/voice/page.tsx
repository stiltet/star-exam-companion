import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { VoiceRound } from "@/components/voice-round"

// Static: the round is built on the device, so the page opens offline from the service worker's cache.
export default function VoicePage() {
  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 flex flex-col max-w-4xl mx-auto px-4 pt-2 sm:pt-8 pb-6 w-full">
        <VoiceRound />
      </main>
      <SiteFooter flush />
    </div>
  )
}
