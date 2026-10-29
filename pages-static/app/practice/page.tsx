import { Suspense } from "react"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { PracticeView } from "@/components/practice-view"
import { loadPlay } from "@/lib/load"
import { sectionLabel } from "@/lib/progress"
import { quizQuestions } from "@/lib/questions"
import type { Question } from "@/lib/exam-data"

// The online demo's Practice page. The real page reads the filter from the address on the server;
// a static site has no server, so here the questions are worked out once at build time and the
// filter is applied in the browser (PracticeView). scripts/build-pages.sh copies this over
// quiz/app/practice in a temporary build copy; the real page is never changed.
export default function PracticePage() {
  const play = loadPlay()
  const questions: Question[] = play.ok ? quizQuestions(play.glossary, play.items) : []
  const sections = [1, 2, 3, 4].map((id) => ({
    id: String(id),
    title: sectionLabel(id, play.ok ? (play.weights[id] ?? 0) : 0),
    ids: questions.filter((q) => q.sectionId === String(id)).map((q) => q.id),
  }))

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />

      <main className="flex-1 max-w-4xl mx-auto px-4 py-8 w-full">
        <h1 className="sr-only text-2xl font-bold mb-2">PRACTICE QUESTIONS</h1>
        <p className="text-muted-foreground mb-6">Individual questions with detailed explanations. Filter by section.</p>

        <Suspense fallback={<div className="border-2 border-foreground p-6 text-center text-muted-foreground">Loading questions…</div>}>
          <PracticeView questions={questions} sections={sections} />
        </Suspense>
      </main>

      <SiteFooter />
    </div>
  )
}
