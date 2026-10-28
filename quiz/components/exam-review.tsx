"use client"

import { useState } from "react"
import type { Question } from "@/lib/exam-data"
import { filterRows, reviewRows, type ReviewFilter, type ReviewRow, type SavedExam } from "@/lib/exam-review"
import { EXAM_TARGET } from "@/lib/learn"
import { ActionButton } from "@/components/atoms/button"
import { Badge } from "@/components/atoms/badge"
import { Choice, type ChoiceState } from "@/components/atoms/choice"
import { Heading } from "@/components/atoms/heading"
import { SectionBar } from "@/components/atoms/section-bar"

// A finished exam, question by question: the answer chosen, the right one and why, and the flags.
// The results screen shows it straight after an exam; Progress and the exam page open past ones.
export type ReviewedExam = SavedExam & { date: string; seconds: number; retake?: boolean }

type Props = {
  exam: ReviewedExam
  bank: ReadonlyMap<string, Question>
  sections: Array<{ id: string; title: string }>
  unsaved?: boolean
  retakeCount: number
  onRetake: () => void
  onNewExam: () => void
  onClose: () => void
}

const FILTERS: Array<{ id: ReviewFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "wrong", label: "Missed" },
  { id: "flagged", label: "Flagged" },
  { id: "unanswered", label: "Unanswered" },
]

const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`

// Before 27 Oct no answer was kept: only the right one is marked.
function choiceState(row: ReviewRow, index: number, correct: number): ChoiceState {
  if (row.chosen === undefined) return index === correct ? "missed" : "plain"
  if (row.chosen === index) return index === correct ? "right" : "wrong"
  return index === correct ? "missed" : "plain"
}

function ReviewCard({ row, question }: { row: ReviewRow; question: Question | undefined }) {
  return (
    <li className="border-2 border-foreground">
      <div className="p-4 border-b-2 border-foreground bg-muted flex flex-wrap items-center gap-2">
        <span className="font-bold mr-auto">QUESTION {row.number}</span>
        {row.status === "right" && <Badge variant="right">✓ Right</Badge>}
        {row.status === "wrong" && <Badge variant="wrong">✗ Wrong</Badge>}
        {row.status === "unanswered" && <Badge variant="unanswered">Unanswered</Badge>}
        {row.flagged && <Badge variant="flag">⚑ Flagged</Badge>}
      </div>
      {!question ? (
        <p className="p-4 text-muted-foreground">This question is no longer in the question bank, so it cannot be shown.</p>
      ) : (
        <>
          <p className="p-4 font-medium">{question.question}</p>
          <div className="divide-y divide-foreground border-t border-foreground">
            {question.options.map((option, index) => (
              <Choice key={index} index={index} state={choiceState(row, index, question.correctIndex)}>
                {option}
              </Choice>
            ))}
          </div>
          {row.chosen === undefined && (
            <p className="px-4 pt-4 text-sm text-muted-foreground">This exam was saved before answers were kept: only right or wrong is known.</p>
          )}
          <div className="p-4 border-t border-foreground text-sm">
            <span className="font-bold">Why: </span>
            {question.explanation}
            {question.officialDoc && (
              <>
                {" "}
                <a href={question.officialDoc} target="_blank" rel="noopener noreferrer">Source ↗<span className="sr-only"> (opens in a new tab)</span></a>
              </>
            )}
          </div>
        </>
      )}
    </li>
  )
}

export function ExamReview({ exam, bank, sections, unsaved, retakeCount, onRetake, onNewExam, onClose }: Props) {
  const rows = reviewRows(bank, exam)
  const wrongFirst = rows.some((row) => row.status !== "right")
  const [filter, setFilter] = useState<ReviewFilter>(wrongFirst ? "wrong" : "all")
  const total = rows.length
  const correct = rows.filter((row) => row.status === "right").length
  const unanswered = rows.filter((row) => row.status === "unanswered").length
  const flagged = rows.filter((row) => row.flagged).length
  const percent = total > 0 ? Math.round((correct / total) * 100) : 0
  const passed = percent >= EXAM_TARGET
  const shown = filterRows(rows, filter)
  const counts: Record<ReviewFilter, number> = { all: total, wrong: total - correct, flagged, unanswered }
  const bySection = sections.map((section) => {
    const own = rows.filter((row) => bank.get(row.id)?.sectionId === section.id)
    return { ...section, total: own.length, correct: own.filter((row) => row.status === "right").length }
  })

  return (
    <div>
      <Heading variant="page" placement="mb-2">{exam.retake ? "RETAKE RESULTS" : "EXAM RESULTS"}</Heading>
      <p className="text-muted-foreground mb-6">{exam.date} · {total} questions{exam.retake ? " · a retake, not counted as a practice exam" : ""}</p>
      {unsaved && <p role="alert" className="mb-6 font-bold">This exam was not saved. This device could not keep it and the Mac could not be reached. It stays here until you leave this page.</p>}

      <div className={`border-2 border-foreground p-6 mb-6 text-center ${passed && !exam.retake ? "bg-foreground text-background" : "bg-muted"}`}>
        <div className="text-4xl font-bold mb-2">{percent}%</div>
        <div className="text-lg mb-2">{correct} / {total} CORRECT</div>
        {!exam.retake && (
          <>
            <div className="font-bold">{passed ? "PASSED" : "NOT PASSED"}</div>
            <div className="text-sm mt-1">(Target: {EXAM_TARGET}%)</div>
          </>
        )}
      </div>

      <div className="border-2 border-foreground mb-6 overflow-x-auto">
        <SectionBar variant="muted">SUMMARY</SectionBar>
        <table className="w-full text-sm">
          <tbody>
            <tr className="border-b border-foreground"><th scope="row" className="p-3 text-left font-normal text-muted-foreground">Wrong</th><td className="p-3 text-right font-bold">{total - correct - unanswered}</td></tr>
            <tr className="border-b border-foreground"><th scope="row" className="p-3 text-left font-normal text-muted-foreground">Unanswered</th><td className="p-3 text-right font-bold">{exam.answers ? unanswered : "not saved"}</td></tr>
            <tr className="border-b border-foreground"><th scope="row" className="p-3 text-left font-normal text-muted-foreground">Flagged</th><td className="p-3 text-right font-bold">{exam.flagged ? flagged : "not saved"}</td></tr>
            <tr><th scope="row" className="p-3 text-left font-normal text-muted-foreground">Time used</th><td className="p-3 text-right font-bold">{clock(exam.seconds)}</td></tr>
          </tbody>
        </table>
      </div>

      <div className="border-2 border-foreground mb-6 overflow-x-auto">
        <SectionBar variant="muted">SECTION BREAKDOWN</SectionBar>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-foreground">
              <th className="text-left p-3">SECTION</th>
              <th className="text-right p-3">SCORE</th>
              <th className="text-right p-3">%</th>
            </tr>
          </thead>
          <tbody>
            {bySection.map((section) => (
              <tr key={section.id} className="border-b border-foreground last:border-b-0">
                <td className="p-3">{section.title}</td>
                <td className="p-3 text-right whitespace-nowrap">{section.correct}/{section.total}</td>
                <td className="p-3 text-right font-bold">{section.total > 0 ? Math.round((section.correct / section.total) * 100) : 0}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        {retakeCount > 0 && (
          <ActionButton variant="filled" placement="sm:flex-1" onClick={onRetake}>Retake wrong + flagged ({retakeCount})</ActionButton>
        )}
        <ActionButton variant="outlined" placement="sm:flex-1" onClick={onNewExam}>New exam</ActionButton>
        <ActionButton variant="outlined" placement="sm:flex-1" onClick={onClose}>Back</ActionButton>
      </div>

      <Heading variant="label" placement="mb-2">QUESTIONS</Heading>
      <div role="group" aria-label="Show questions" className="flex flex-wrap gap-2 mb-4">
        {FILTERS.map((item) => (
          <ActionButton key={item.id} variant="toggle" aria-pressed={filter === item.id} onClick={() => setFilter(item.id)}>
            {item.label} ({counts[item.id]})
          </ActionButton>
        ))}
      </div>
      {shown.length === 0 ? (
        <p className="border-2 border-foreground p-4 mb-6">No question here.</p>
      ) : (
        <ol className="space-y-4 mb-6 list-none p-0">
          {shown.map((row) => <ReviewCard key={row.id} row={row} question={bank.get(row.id)} />)}
        </ol>
      )}
    </div>
  )
}
