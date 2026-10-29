import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { EXAM_SECTIONS } from "@/lib/exam-data"
import { writtenQuestions } from "@/lib/questions"
import { sectionLabel } from "@/lib/progress"
import Link from "next/link"
import { notFound } from "next/navigation"

type Props = {
  params: Promise<{ sectionId: string; topicId: string }>
}

// Every topic is known at build time, so the online demo can export its pages.
export function generateStaticParams() {
  return EXAM_SECTIONS.flatMap((section) => section.topics.map((topic) => ({ sectionId: section.id, topicId: topic.id })))
}

export default async function TopicPage({ params }: Props) {
  const { sectionId, topicId } = await params

  const section = EXAM_SECTIONS.find((s) => s.id === sectionId)
  if (!section) notFound()

  const sectionIndex = EXAM_SECTIONS.findIndex((s) => s.id === sectionId)
  const label = sectionLabel(sectionIndex + 1, section.weight)
  const topic = section.topics.find((t) => t.id === topicId)
  if (!topic) notFound()

  const topicIndex = section.topics.findIndex((t) => t.id === topicId)
  const prevTopic = topicIndex > 0 ? section.topics[topicIndex - 1] : null
  const nextTopic = topicIndex < section.topics.length - 1 ? section.topics[topicIndex + 1] : null

  const relatedQuestions = writtenQuestions().filter((q) => q.topicId === topicId)

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />

      <main className="flex-1 max-w-4xl mx-auto px-4 py-8 w-full">
        {/* Breadcrumb */}
        <nav className="text-sm mb-6 text-muted-foreground">
          <Link href="/study">STUDY</Link>
          <span className="mx-2">/</span>
          <Link href={`/study/${sectionId}`}>{label.toUpperCase()}</Link>
          <span className="mx-2">/</span>
          <span className="text-foreground">{topic.title.toUpperCase()}</span>
        </nav>

        {/* Header */}
        <header className="border-2 border-foreground p-6 mb-6">
          <div className="text-sm text-muted-foreground mb-2">
            {label}
          </div>
          <h1 className="text-2xl font-bold">{topic.title}</h1>
        </header>

        {/* Concepts */}
        <section className="mb-6">
          <h2 className="text-lg font-bold border-b-2 border-foreground pb-2 mb-4">KEY CONCEPTS</h2>
          <ul className="space-y-2">
            {Array.isArray(topic.concepts) && topic.concepts.length > 0 ? (
              topic.concepts.map((concept, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-muted-foreground">→</span>
                  <span>{concept}</span>
                </li>
              ))
            ) : (
              <li className="text-muted-foreground">No concepts listed for this topic.</li>
            )}
          </ul>
        </section>

        {/* Exam Focus */}
        <section className="border-2 border-foreground p-6 mb-6 bg-muted">
          <h2 className="text-lg font-bold mb-2">WHAT THE EXAM IS REALLY TESTING</h2>
          <p>{topic.examFocus}</p>
        </section>

        {/* Common Traps */}
        <section className="mb-6">
          <h2 className="text-lg font-bold border-b-2 border-foreground pb-2 mb-4">COMMON TRAPS</h2>
          <ul className="space-y-2">
            {Array.isArray(topic.traps) && topic.traps.length > 0 ? (
              topic.traps.map((trap, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-destructive font-bold">!</span>
                  <span>{trap}</span>
                </li>
              ))
            ) : (
              <li className="text-muted-foreground">No traps listed for this topic.</li>
            )}
          </ul>
        </section>


        {/* Official Documentation */}
        <section className="mb-6">
          <h2 className="text-lg font-bold border-b-2 border-foreground pb-2 mb-4">OFFICIAL DOCUMENTATION</h2>
          <ul className="space-y-2">
            {Array.isArray(topic.officialDocs) && topic.officialDocs.length > 0 ? (
              topic.officialDocs.map((doc: { url: string; title: string }, i: number) => (
                <li key={i}>
                  <a href={doc.url} target="_blank" rel="noopener noreferrer" className="flex gap-2 items-start">
                    <span className="text-muted-foreground">[DOC]</span>
                    <span>{doc.title}</span>
                  </a>
                </li>
              ))
            ) : (
              <li className="text-muted-foreground">No official docs for this topic.</li>
            )}
          </ul>
        </section>

        {/* Study Q&A */}
        {Array.isArray(topic.studyQA) && topic.studyQA.length > 0 && (
          <section className="mb-6">
            <h2 className="text-lg font-bold border-b-2 border-foreground pb-2 mb-4">STUDY Q&A</h2>
            <ul className="space-y-6">
              {topic.studyQA.map((qa: { question: string; answer: string; officialSource: string }, i: number) => (
                <li key={"topic-" + i} className="border p-4 rounded-md bg-muted">
                  <div className="font-semibold mb-2">{qa.question}</div>
                  <div className="mb-2">{qa.answer}</div>
                  <div className="text-xs text-muted-foreground">
                    <a href={qa.officialSource} target="_blank" rel="noopener noreferrer" className="underline">
                      Official source
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Related Questions */}
        {relatedQuestions.length > 0 && (
          <section className="mb-6">
            <h2 className="text-lg font-bold border-b-2 border-foreground pb-2 mb-4">PRACTICE QUESTIONS</h2>
            <p className="text-muted-foreground mb-2">
              {relatedQuestions.length} question{relatedQuestions.length !== 1 ? "s" : ""} available for this topic
            </p>
            <Link
              href={`/practice?topic=${topicId}`}
              className="inline-block border-2 border-foreground px-4 py-2 no-underline hover:bg-foreground hover:text-background"
            >
              PRACTICE NOW →
            </Link>
          </section>
        )}

        {/* Navigation */}
        <nav className="border-t-2 border-foreground pt-6 flex justify-between">
          {prevTopic ? (
            <Link href={`/study/${sectionId}/${prevTopic.id}`} className="text-sm">
              ← {prevTopic.title}
            </Link>
          ) : (
            <span />
          )}
          {nextTopic ? (
            <Link href={`/study/${sectionId}/${nextTopic.id}`} className="text-sm">
              {nextTopic.title} →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      </main>

      <SiteFooter />
    </div>
  )
}
