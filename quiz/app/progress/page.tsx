import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { activePack, listPacks } from "@/lib/pack"
import { writtenPool } from "@/lib/questions"
import { ProgressClient } from "@/components/progress-client"

// Static: the scores are read on the device, from the Mac's copy and the answers not yet sent.
export default function ProgressPage() {
  const pack = activePack()
  const stats = {
    exam: { id: pack.meta.id, title: pack.meta.title },
    exams: listPacks(),
    written: writtenPool({ questions: pack.study.questions, sectionOf: pack.meta.sectionOf }),
    sectionOf: pack.meta.sectionOf,
    sections: pack.study.sections.map((s) => ({
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
