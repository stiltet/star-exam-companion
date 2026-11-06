import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { Heading } from "@/components/atoms/heading"
import { Text } from "@/components/atoms/text"
import { PrivateReadingCapture } from "@/components/private-reading-capture"
import { activePack } from "@/lib/pack"

export const dynamic = "force-dynamic"

export default function PrivateReadingCapturePage() {
  const pack = activePack()
  const templates = pack.courses.filter((course) => course.provider === "private").map((course) => course.template)
  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 max-w-4xl mx-auto px-4 py-8 w-full">
        <Heading variant="page" placement="mb-4">Send to Star</Heading>
        <Text variant="muted" placement="mb-6">A private copy is saved only on this server. Keep this tab open while the bookmarklet sends the reading.</Text>
        <PrivateReadingCapture packId={pack.meta.id} templates={templates} />
      </main>
      <SiteFooter />
    </div>
  )
}
