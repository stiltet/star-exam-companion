import { PageShell } from "@/components/organisms/page-shell"
import { activePack, listPacks } from "@/lib/pack"
import { writtenPool } from "@/lib/questions"
import { ProgressClient } from "@/components/progress-client"

// Static: the scores are read on the device, from the Mac's copy and the answers not yet sent.
export default function ProgressPage() {
  const pack = activePack()
  const stats = {
    exam: { id: pack.meta.id, title: pack.meta.title },
    courses: pack.courses.map((course) => ({ id: course.id, title: course.title })),
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
    <PageShell>
      <>
        <ProgressClient stats={stats} />
      </>
    </PageShell>
  )
}
