import { PageShell } from "@/components/organisms/page-shell"
import { NightReader } from "@/components/night-reader"

// Static: the player and the stored recording live on the device, so the page opens offline.
export default function NightPage() {
  return (
    <PageShell>
      <h1 className="sr-only text-2xl font-bold mb-4">Night reading</h1>
      <NightReader />
    </PageShell>
  )
}
