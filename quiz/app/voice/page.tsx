import { PageShell } from "@/components/organisms/page-shell"
import { VoiceRound } from "@/components/voice-round"
import { UnfinishedNotice } from "@/components/unfinished-notice"

// Static: the round is built on the device, so the page opens offline from the service worker's cache.
export default function VoicePage() {
  return (
    <PageShell variant="fill">
      <UnfinishedNotice need="scenes" />
      <VoiceRound />
    </PageShell>
  )
}
