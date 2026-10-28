import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { EXAM_SECTIONS } from "@/lib/exam-data"
import { ProgressClient } from "@/components/progress-client"

// Static: the scores are read on the device, from the Mac's copy and the answers not yet sent.
export default function ProgressPage() {
  const stats = {
    sections: EXAM_SECTIONS.map((s) => ({
      id: s.id,
      title: s.title,
      weight: s.weight,
      topicCount: s.topics.length,
    })),
  }

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />

      <main className="flex-1 max-w-4xl mx-auto px-4 py-8 w-full">
        <ProgressClient stats={stats} />
      </main>

      <SiteFooter />
    </div>
  )
}
