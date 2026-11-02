import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import Link from "next/link"
import { Text } from "@/components/atoms/text"
import { PracticeQuestionClient } from "@/components/practice-question-client"
import { PracticeUnanswered, UnansweredCount } from "@/components/practice-unanswered"
import { loadPlay } from "@/lib/load"
import { sectionLabel } from "@/lib/progress"
import { quizQuestions } from "@/lib/questions"
import type { Question } from "@/lib/exam-data"

type Props = {
  searchParams: Promise<{ topic?: string; section?: string; unanswered?: string }>
}

export default async function PracticePage({ searchParams }: Props) {
  const { topic, section, unanswered } = await searchParams
  // Unanswered: questions never answered in any mode, worked out on the device. It is a switch
  // that combines with ALL, a section or a topic (owner, 28 Oct).
  const onlyUnanswered = unanswered === "1"
  const play = loadPlay()
  const questions: Question[] = play.ok ? quizQuestions(play.glossary, play.items, play.bank) : []
  let filteredQuestions = questions
  if (topic) filteredQuestions = questions.filter((q) => q.topicId === topic)
  else if (section) filteredQuestions = questions.filter((q) => q.sectionId === section)
  const filter = (topic ? `topic=${topic}` : section ? `section=${section}` : "all") + (onlyUnanswered ? "&unanswered=1" : "")
  // A filter link keeps the Unanswered switch as it is; the switch keeps the section or topic.
  const link = (params: Record<string, string>, unansweredOn: boolean) => {
    const query = new URLSearchParams({ ...params, ...(unansweredOn ? { unanswered: "1" } : {}) }).toString()
    return query ? `/practice?${query}` : "/practice"
  }
  const place: Record<string, string> = topic ? { topic } : section ? { section } : {}
  const sections = (play.ok ? Object.keys(play.weights).map(Number).sort((a, b) => a - b) : []).map((id) => ({
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

        {/* Filter */}
        <div className="border-2 border-foreground p-4 mb-6">
          <h2 className="font-bold mb-2">FILTER BY SECTION</h2>
          <div className="flex flex-wrap gap-2">
            <Link
              href={link({}, onlyUnanswered)}
              className={`border border-foreground px-3 py-1 text-sm no-underline ${
                !section && !topic ? "bg-foreground text-background" : "hover:bg-muted"
              }`}
            >
              ALL ({onlyUnanswered ? <UnansweredCount ids={questions.map((q) => q.id)} /> : questions.length})
            </Link>
            <Link
              href={link(place, !onlyUnanswered)}
              aria-current={onlyUnanswered ? "true" : undefined}
              className={`border border-foreground px-3 py-1 text-sm no-underline ${
                onlyUnanswered ? "bg-foreground text-background" : "hover:bg-muted"
              }`}
            >
              UNANSWERED
            </Link>
            {sections.map((s) => (
              <Link
                key={s.id}
                href={link({ section: s.id }, onlyUnanswered)}
                className={`border border-foreground px-3 py-1 text-sm no-underline ${
                  section === s.id ? "bg-foreground text-background" : "hover:bg-muted"
                }`}
              >
                {s.title} ({onlyUnanswered ? <UnansweredCount ids={s.ids} /> : s.ids.length})
              </Link>
            ))}
          </div>
        </div>

        {/* Questions */}
        {onlyUnanswered ? (
          <PracticeUnanswered key={filter} questions={filteredQuestions} filter={filter} sectionTitles={Object.fromEntries(sections.map((s) => [s.id, s.title]))} />
        ) : filteredQuestions.length === 0 ? (
          <Text variant="notice" role="status">No questions available for this filter.</Text>
        ) : (
          <PracticeQuestionClient key={filter} questions={filteredQuestions} filter={filter} sectionTitles={Object.fromEntries(sections.map((s) => [s.id, s.title]))} />
        )}
      </main>

      <SiteFooter />
    </div>
  )
}
