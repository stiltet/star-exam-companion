import { PageShell } from "@/components/organisms/page-shell"
import { Text } from "@/components/atoms/text"
import { UnfinishedNotice } from "@/components/unfinished-notice"
import { ExamClient } from "@/components/exam-client"
import { loadPlay } from "@/lib/load"
import { sectionLabel } from "@/lib/progress"
import { quizQuestions } from "@/lib/questions"
import type { Question } from "@/lib/exam-data"
import { connection } from "next/server"
import { STATIC_DEMO } from "@/lib/static-demo"

// Rendered per request, so an edit to glossary.md shows without a rebuild. The online demo is
// built once, as plain files, so it does not wait for a request.
export default async function ExamPage() {
  if (!STATIC_DEMO) await connection()
  const play = loadPlay()
  const questions: Question[] = play.ok ? quizQuestions(play.glossary, play.items, play.bank) : []
  const sections = (play.ok ? Object.keys(play.weights).map(Number).sort((a, b) => a - b) : []).map((id) => ({
    id: String(id),
    title: sectionLabel(id, play.ok ? (play.weights[id] ?? 0) : 0),
    weight: play.ok ? (play.weights[id] ?? 0) : 0,
  }))
  // An exam that does not load has no exam to time, so the page shows none of it.
  if (!play.ok) return <PageShell><Text variant="notice" role="alert">{play.error}</Text></PageShell>
  return (
    <PageShell>
      <UnfinishedNotice need="questions" />
      <ExamClient questions={questions} sections={sections} length={play.pack.meta.exam} />
    </PageShell>
  )
}
