import { SiteHeader } from "@/components/site-header"
import { Text } from "@/components/atoms/text"
import { SiteFooter } from "@/components/site-footer"
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
  if (!play.ok) return <div className="min-h-screen flex flex-col"><SiteHeader /><main className="flex-1 max-w-4xl mx-auto px-4 py-8 w-full"><Text variant="notice" role="alert">{play.error}</Text></main><SiteFooter /></div>
  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 max-w-4xl mx-auto px-4 py-8 w-full">
        <ExamClient questions={questions} sections={sections} length={play.pack.meta.exam} />
      </main>
      <SiteFooter />
    </div>
  )
}
