"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { PracticeQuestionClient } from "@/components/practice-question-client"
import { PracticeUnanswered, UnansweredCount } from "@/components/practice-unanswered"
import type { Question } from "@/lib/exam-data"
import { practiceFilter, practiceLink } from "@/lib/practice-filter"
import { STATIC_DEMO } from "@/lib/static-demo"

type Section = { id: string; title: string; ids: string[] }

// The filter and the questions under it. It reads the address in the browser, so the same page can
// be exported as plain files for the online demo.
export function PracticeView({ questions, sections }: { questions: Question[]; sections: Section[] }) {
  const params = useSearchParams()
  const topic = params.get("topic") ?? undefined
  const section = params.get("section") ?? undefined
  // Unanswered asks the Mac for the answers so far; the online demo has no Mac, so it has no switch.
  const { filtered, key, onlyUnanswered } = practiceFilter(
    questions,
    { topic, section, unanswered: params.get("unanswered") ?? undefined },
    !STATIC_DEMO,
  )
  const place: Record<string, string> = topic ? { topic } : section ? { section } : {}
  const sectionTitles = Object.fromEntries(sections.map((s) => [s.id, s.title]))

  return (
    <>
      {/* Filter */}
      <div className="border-2 border-foreground p-4 mb-6">
        <h2 className="font-bold mb-2">FILTER BY SECTION</h2>
        <div className="flex flex-wrap gap-2">
          <Link
            href={practiceLink({}, onlyUnanswered)}
            className={`border border-foreground px-3 py-1 text-sm no-underline ${
              !section && !topic ? "bg-foreground text-background" : "hover:bg-muted"
            }`}
          >
            ALL ({onlyUnanswered ? <UnansweredCount ids={questions.map((q) => q.id)} /> : questions.length})
          </Link>
          {!STATIC_DEMO && (
            <Link
              href={practiceLink(place, !onlyUnanswered)}
              aria-current={onlyUnanswered ? "true" : undefined}
              className={`border border-foreground px-3 py-1 text-sm no-underline ${
                onlyUnanswered ? "bg-foreground text-background" : "hover:bg-muted"
              }`}
            >
              UNANSWERED
            </Link>
          )}
          {sections.map((s) => (
            <Link
              key={s.id}
              href={practiceLink({ section: s.id }, onlyUnanswered)}
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
        <PracticeUnanswered key={key} questions={filtered} filter={key} sectionTitles={sectionTitles} />
      ) : filtered.length === 0 ? (
        <div className="border-2 border-foreground p-6 text-center text-muted-foreground">
          No questions available for this filter.
        </div>
      ) : (
        <PracticeQuestionClient key={key} questions={filtered} filter={key} sectionTitles={sectionTitles} />
      )}
    </>
  )
}
