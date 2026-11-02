"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { keepAnswer } from "@/components/outbox"
import { mergeLines, newAnswer, readOutbox, readRejected } from "@/lib/outbox"
import type { Question } from "@/lib/exam-data"
import { examDuration, retakeIds, reviewHash, reviewId, shuffle } from "@/lib/exam-review"
import { EXAM_TARGET } from "@/lib/learn"
import { Text } from "@/components/atoms/text"
import { examHistory } from "@/lib/progress"
import { EXAM_KEY, examOutcome, examResume, examSeconds, loadState, saveState, secondsLeft } from "@/lib/resume"
import type { ExamLength } from "@/lib/score"
import { useSnapshot } from "@/components/snapshot"
import { ExamReview, type ReviewedExam } from "@/components/exam-review"
import { ActionButton } from "@/components/atoms/button"
import { Choice } from "@/components/atoms/choice"
import { Heading } from "@/components/atoms/heading"
import { NavCell } from "@/components/atoms/nav-cell"
import { SectionBar } from "@/components/atoms/section-bar"

type ExamState = "intro" | "active"

type Props = {
  questions: Question[]
  // The real exam's length, from the exam pack.
  length: ExamLength
  sections: Array<{ id: string; title: string; weight: number }>
}

type Clock = { startedAt: number; endsAt: number }

const formatTime = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`

// The URL hash names the exam under review, so a reload, the Back button and a Progress link all
// open the same review, from the stored page when offline.
function setHash(id: string | null) {
  const url = `${window.location.pathname}${window.location.search}${id ? reviewHash(id) : ""}`
  window.history.replaceState(window.history.state, "", url)
  window.dispatchEvent(new HashChangeEvent("hashchange"))
}

export function ExamClient({ questions, sections, length }: Props) {
  const MAX_EXAM_QUESTIONS = length.questions
  // An exam asks the real exam's number of questions, or all there are when the pack has fewer. The
  // time scales with the questions asked, so 17 questions are not given the real exam's whole clock.
  const EXAM_SECONDS = examDuration(Math.min(MAX_EXAM_QUESTIONS, questions.length), length)
  const [examState, setExamState] = useState<ExamState>("intro")
  const [examQuestions, setExamQuestions] = useState<Question[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<Map<string, number>>(new Map())
  const [flagged, setFlagged] = useState<Set<string>>(new Set())
  const [timeRemaining, setTimeRemaining] = useState(EXAM_SECONDS)
  const [showEndDialog, setShowEndDialog] = useState(false)
  const [clock, setClock] = useState<Clock | null>(null)
  // A retake of missed and flagged questions: reviewable, but not a practice exam.
  const [isRetake, setIsRetake] = useState(false)
  const [unsaved, setUnsaved] = useState(false)
  const [notResumed, setNotResumed] = useState(false)
  const [reviewing, setReviewing] = useState<string | null>(null)
  // The exam just finished, kept here in case this device could not save it.
  const [justFinished, setJustFinished] = useState<(ReviewedExam & { id: string }) | null>(null)
  const finished = useRef(false)
  const dialog = useRef<HTMLDivElement>(null)
  const endButton = useRef<HTMLDivElement>(null)
  const { lines } = useSnapshot()
  const bank = useMemo(() => new Map(questions.map((q) => [q.id, q])), [questions])
  // Every exam and retake this device knows: the Mac's, and any still waiting on the device or
  // refused by the Mac, so one finished offline can be reviewed before it is sent.
  const everything = useMemo(() => {
    if (typeof window === "undefined") return examHistory(lines, "all")
    return examHistory(mergeLines(lines, [...readOutbox(window.localStorage), ...readRejected(window.localStorage)]), "all")
  }, [lines])
  // Past exams lists practice exams only.
  const history = everything.filter((exam) => !exam.retake)

  // The weighted exam: each section's share of MAX_EXAM_QUESTIONS, then any shortfall from the rest, shuffled.
  const generateExam = useCallback(() => {
    const picked: Question[] = []
    for (const section of sections) {
      const own = questions.filter((q) => q.sectionId === section.id)
      picked.push(...shuffle(own).slice(0, Math.round((section.weight / 100) * MAX_EXAM_QUESTIONS)))
    }
    let unique = [...new Map(picked.map((q) => [q.id, q])).values()]
    if (unique.length < MAX_EXAM_QUESTIONS) {
      const used = new Set(unique.map((q) => q.id))
      unique = unique.concat(shuffle(questions.filter((q) => !used.has(q.id))).slice(0, MAX_EXAM_QUESTIONS - unique.length))
    }
    return shuffle(unique).slice(0, MAX_EXAM_QUESTIONS)
  }, [questions, sections])

  // Ends the exam once: saves its line, with every answer and flag, through the outbox, forgets
  // the exam in progress and opens its review.
  const finish = useCallback((list: Question[], given: Map<string, number>, marked: Set<string>, started: Clock, at: number, retake: boolean) => {
    if (finished.current) return
    finished.current = true
    const seconds = examSeconds(started.startedAt, Math.min(at, started.endsAt), Math.round((started.endsAt - started.startedAt) / 1000))
    const { asked, missed } = examOutcome(list, Object.fromEntries(given))
    const kept = { answers: Object.fromEntries(given), flagged: asked.filter((id) => marked.has(id)), ...(retake ? { retake: true as const } : {}) }
    const answer = newAnswer("exam", asked, missed, { seconds, ...kept })
    saveState(window.localStorage, EXAM_KEY, null)
    setShowEndDialog(false)
    setJustFinished({ id: answer.id, date: answer.at.slice(0, 10), asked, missed, seconds, ...kept })
    setExamState("intro")
    setHash(answer.id)
    window.scrollTo(0, 0)
    void keepAnswer(answer).then((saved) => setUnsaved(!saved))
  }, [])

  // The exam under review follows the hash.
  useEffect(() => {
    const follow = () => setReviewing(reviewId(window.location.hash))
    follow()
    window.addEventListener("hashchange", follow)
    return () => window.removeEventListener("hashchange", follow)
  }, [])

  // Reopens an exam in progress. If its time ran out while the app was closed, it ends with the answers given.
  useEffect(() => {
    const kept = loadState(window.localStorage, EXAM_KEY)
    const saved = examResume(kept, new Set(questions.map((q) => q.id)))
    if (!saved) {
      // A kept exam that names a question no longer in the glossary cannot be marked fairly.
      if (kept !== null) {
        saveState(window.localStorage, EXAM_KEY, null)
        setNotResumed(true)
      }
      return
    }
    const byId = new Map(questions.map((q) => [q.id, q]))
    const list = saved.ids.map((id) => byId.get(id)).filter((q): q is Question => q !== undefined)
    const given = new Map(Object.entries(saved.answers))
    const marked = new Set(saved.flagged)
    const started = { startedAt: saved.startedAt, endsAt: saved.endsAt }
    setExamQuestions(list)
    setAnswers(given)
    setFlagged(marked)
    setCurrentIndex(saved.index)
    setClock(started)
    setIsRetake(saved.retake)
    finished.current = false
    if (secondsLeft(saved.endsAt, Date.now()) === 0) finish(list, given, marked, started, saved.endsAt, saved.retake)
    else {
      setTimeRemaining(secondsLeft(saved.endsAt, Date.now()))
      // An exam kept in the old review mode carries on as an exam in progress.
      setExamState("active")
    }
  }, [questions, finish])

  // Kept on the device after every change, so closing the app loses nothing.
  useEffect(() => {
    if (examState !== "active" || !clock) return
    saveState(window.localStorage, EXAM_KEY, {
      ids: examQuestions.map((q) => q.id),
      answers: Object.fromEntries(answers),
      flagged: [...flagged],
      index: currentIndex,
      state: "active",
      ...clock,
      retake: isRetake,
    })
  }, [examState, examQuestions, answers, flagged, currentIndex, clock, isRetake])

  // The clock runs from endsAt, as in the real exam.
  useEffect(() => {
    if (examState !== "active" || !clock) return
    const tick = () => {
      const left = secondsLeft(clock.endsAt, Date.now())
      setTimeRemaining(left)
      if (left === 0) finish(examQuestions, answers, flagged, clock, Date.now(), isRetake)
    }
    const timer = setInterval(tick, 1000)
    return () => clearInterval(timer)
  }, [examState, clock, examQuestions, answers, flagged, isRetake, finish])

  // Starts a full exam, or a retake of the given questions with the same time per question.
  const startExam = (ids?: string[]) => {
    const list = ids ? shuffle(ids.map((id) => bank.get(id)).filter((q): q is Question => q !== undefined)) : generateExam()
    const startedAt = Date.now()
    const duration = examDuration(list.length, length)
    finished.current = false
    setUnsaved(false)
    setJustFinished(null)
    setExamQuestions(list)
    setAnswers(new Map())
    setFlagged(new Set())
    setCurrentIndex(0)
    setTimeRemaining(duration)
    setClock({ startedAt, endsAt: startedAt + duration * 1000 })
    setIsRetake(ids !== undefined)
    setExamState("active")
    setHash(null)
    window.scrollTo(0, 0)
  }

  const endExam = () => {
    if (clock) finish(examQuestions, answers, flagged, clock, Date.now(), isRetake)
  }

  const handleAnswer = (questionId: string, answerIndex: number) => {
    setAnswers((prev) => new Map(prev).set(questionId, answerIndex))
  }

  const toggleFlag = (questionId: string) => {
    setFlagged((prev) => {
      const next = new Set(prev)
      if (next.has(questionId)) next.delete(questionId)
      else next.add(questionId)
      return next
    })
  }

  // The next other question that matches, wrapping round; null when only the current one does.
  const nextWhere = (match: (q: Question) => boolean): number | null => {
    for (let step = 1; step < examQuestions.length; step++) {
      const index = (currentIndex + step) % examQuestions.length
      const q = examQuestions[index]
      if (q && match(q)) return index
    }
    return null
  }
  const goTo = (index: number | null) => {
    if (index === null) return
    setShowEndDialog(false)
    setCurrentIndex(index)
  }

  // The end dialog takes focus when it opens, keeps Tab inside it, and gives focus back to End
  // exam when it closes.
  useEffect(() => {
    if (!showEndDialog) return
    const box = dialog.current
    const buttons = () => [...(box?.querySelectorAll<HTMLButtonElement>("button:not([disabled])") ?? [])]
    buttons()[0]?.focus()
    const trap = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return
      const list = buttons()
      const first = list[0]
      const last = list[list.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last?.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first?.focus()
      }
    }
    box?.addEventListener("keydown", trap)
    const after = endButton.current
    return () => {
      box?.removeEventListener("keydown", trap)
      after?.querySelector("button")?.focus()
    }
  }, [showEndDialog])

  // Keys while answering: A–D or 1–4 choose, F flags, ← and → move, Escape closes the dialog.
  useEffect(() => {
    if (examState !== "active") return
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (event.target instanceof HTMLElement && event.target.closest("input, textarea, select, [contenteditable]")) return
      if (showEndDialog) {
        if (event.key === "Escape") setShowEndDialog(false)
        return
      }
      const question = examQuestions[currentIndex]
      if (!question) return
      const key = event.key.toLowerCase()
      const choice = "abcd".indexOf(key) >= 0 ? "abcd".indexOf(key) : "1234".indexOf(key)
      if (key.length === 1 && choice >= 0 && choice < question.options.length) handleAnswer(question.id, choice)
      else if (key === "f") toggleFlag(question.id)
      else if (event.key === "ArrowLeft") setCurrentIndex((index) => Math.max(0, index - 1))
      else if (event.key === "ArrowRight") setCurrentIndex((index) => Math.min(examQuestions.length - 1, index + 1))
      else return
      event.preventDefault()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [examState, showEndDialog, examQuestions, currentIndex])

  // Active Exam
  if (examState === "active" && examQuestions[currentIndex]) {
    const question = examQuestions[currentIndex]
    const isFlagged = flagged.has(question.id)
    const unansweredCount = examQuestions.length - answers.size
    const duration = clock ? Math.round((clock.endsAt - clock.startedAt) / 1000) : EXAM_SECONDS
    const nextFlagged = nextWhere((q) => flagged.has(q.id))
    const nextUnanswered = nextWhere((q) => !answers.has(q.id))

    return (
      <div>
        <Heading variant="page" placement="sr-only">PRACTICE EXAM</Heading>
        {/* Timer Bar */}
        <div className="border-2 border-foreground mb-6 sticky top-0 bg-background z-10">
          <div className="p-3 flex flex-wrap justify-between items-center gap-x-4 gap-y-1">
            <span className="font-bold" role="timer" aria-label={`Time left ${formatTime(timeRemaining)}`}>{formatTime(timeRemaining)}</span>
            <span className="text-sm">
              {currentIndex + 1}/{examQuestions.length} · Unanswered: {unansweredCount} · Flagged: {flagged.size}
            </span>
          </div>
          <div className="h-1 bg-muted">
            <div className="h-full bg-foreground" style={{ width: `${(timeRemaining / duration) * 100}%` }} />
          </div>
        </div>

        {/* Question */}
        <div className="border-2 border-foreground mb-6">
          {/* FLAG shares the label's line, so the question below uses the full width on a phone. */}
          <div className="p-4 border-b border-foreground bg-muted">
            <div className="flex justify-between items-center gap-3">
              <span className="text-sm text-muted-foreground">QUESTION {currentIndex + 1}</span>
              <ActionButton variant="flag" placement="shrink-0" aria-pressed={isFlagged} onClick={() => toggleFlag(question.id)}>
                {isFlagged ? "⚑ Flagged" : "⚑ Flag"}
              </ActionButton>
            </div>
            <p className="font-medium mt-3">{question.question}</p>
          </div>

          <div className="divide-y divide-foreground">
            {question.options.map((option, index) => (
              <Choice key={index} index={index} state={answers.get(question.id) === index ? "selected" : "idle"} onSelect={() => handleAnswer(question.id, index)}>
                {option}
              </Choice>
            ))}
          </div>
        </div>

        {/* Navigation */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          <ActionButton variant="outlined" disabled={currentIndex === 0} aria-disabled={currentIndex === 0} onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}>
            ← Prev
          </ActionButton>
          <ActionButton variant="outlined" disabled={currentIndex === examQuestions.length - 1} aria-disabled={currentIndex === examQuestions.length - 1} onClick={() => setCurrentIndex(Math.min(examQuestions.length - 1, currentIndex + 1))}>
            Next →
          </ActionButton>
        </div>
        <div className="flex flex-wrap gap-2 mb-6">
          <ActionButton variant="toggle" disabled={nextFlagged === null} onClick={() => goTo(nextFlagged)}>
            Next flagged ({flagged.size})
          </ActionButton>
          <ActionButton variant="toggle" disabled={nextUnanswered === null} onClick={() => goTo(nextUnanswered)}>
            Next unanswered ({unansweredCount})
          </ActionButton>
        </div>

        {/* Question Navigator */}
        <div className="border-2 border-foreground p-4 mb-6">
          <Heading variant="label" placement="mb-3">QUESTION NAVIGATOR</Heading>
          <div className="flex flex-wrap gap-2">
            {examQuestions.map((q, index) => (
              <NavCell key={q.id} number={index + 1} answered={answers.has(q.id)} flagged={flagged.has(q.id)} current={index === currentIndex} onSelect={() => setCurrentIndex(index)} />
            ))}
          </div>
          <div className="mt-3 text-xs flex flex-wrap gap-x-4 gap-y-1 border-t border-foreground pt-2">
            <span className="flex items-center gap-1"><span aria-hidden="true" className="inline-block size-4 bg-foreground border-2 border-foreground" />Answered</span>
            <span className="flex items-center gap-1"><span aria-hidden="true" className="inline-block size-4 bg-background border-2 border-foreground" />Unanswered</span>
            <span className="flex items-center gap-1"><span aria-hidden="true" className="inline-block size-4 bg-flag border-2 border-foreground" />Flagged (corner)</span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground hidden sm:block">Keys: A–D answer · F flag · ← → move</p>
        </div>

        <div ref={endButton}>
          <ActionButton variant="danger" placement="w-full" onClick={() => setShowEndDialog(true)}>
            End exam
          </ActionButton>
        </div>

        {/* End Exam Confirmation Dialog */}
        {showEndDialog && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="end-exam-title" className="bg-background text-foreground border-2 border-foreground p-6 max-w-md w-full">
              <Heading variant="label" id="end-exam-title" placement="mb-4">END EXAM?</Heading>
              <ul className="mb-6 text-sm space-y-1">
                <li><strong>{unansweredCount}</strong> unanswered{unansweredCount > 0 ? " (they count as wrong)" : ""}</li>
                <li><strong>{flagged.size}</strong> flagged</li>
              </ul>
              <div className="flex flex-col gap-3">
                {nextFlagged !== null && <ActionButton variant="outlined" onClick={() => goTo(nextFlagged)}>Go to flagged</ActionButton>}
                {nextUnanswered !== null && <ActionButton variant="outlined" onClick={() => goTo(nextUnanswered)}>Go to unanswered</ActionButton>}
                <div className="grid grid-cols-2 gap-3">
                  <ActionButton variant="outlined" onClick={() => setShowEndDialog(false)}>Cancel</ActionButton>
                  <ActionButton variant="filled" onClick={endExam}>Submit</ActionButton>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // A finished exam: the one just ended, or a past one named in the hash.
  if (reviewing) {
    const past = everything.find((exam) => exam.id === reviewing)
    const exam: ReviewedExam | null = past ?? (justFinished?.id === reviewing ? justFinished : null)
    const close = () => {
      setJustFinished(null)
      setUnsaved(false)
      setHash(null)
    }
    if (!exam) {
      return (
        <div>
          <Heading variant="page" placement="mb-6">EXAM RESULTS</Heading>
          <p className="border-2 border-foreground p-4 mb-6">This exam is not on this device yet. It appears once this device has fetched your results from the Mac.</p>
          <ActionButton variant="outlined" onClick={close}>Back</ActionButton>
        </div>
      )
    }
    const retake = retakeIds(exam, new Set(bank.keys()))
    return (
      <ExamReview
        key={reviewing}
        exam={exam}
        bank={bank}
        sections={sections}
        unsaved={unsaved && justFinished?.id === reviewing}
        retakeCount={retake.length}
        onRetake={() => startExam(retake)}
        onNewExam={() => startExam()}
        onClose={close}
      />
    )
  }

  // Intro Screen
  return (
    <div>
      <Heading variant="page" placement="sr-only">PRACTICE EXAM</Heading>
      <Text variant="muted" placement="mb-8">Simulated exam environment with realistic pacing.</Text>
      {notResumed && <p role="alert" className="mb-6 font-bold">The exam in progress could not be reopened: the glossary changed since it started. Start a new one.</p>}

      <div className="border-2 border-foreground mb-6">
        <SectionBar>EXAM PARAMETERS</SectionBar>
        <div className="p-4">
          <table className="w-full text-sm">
            <tbody>
              <tr className="border-b border-foreground">
                <td className="py-2 text-muted-foreground">Duration</td>
                <td className="py-2 text-right font-bold">{Math.round(EXAM_SECONDS / 60)} minutes</td>
              </tr>
              <tr className="border-b border-foreground">
                <td className="py-2 text-muted-foreground">Questions</td>
                <td className="py-2 text-right font-bold">{Math.min(MAX_EXAM_QUESTIONS, questions.length)}</td>
              </tr>
              <tr className="border-b border-foreground">
                <td className="py-2 text-muted-foreground">Practice target</td>
                <td className="py-2 text-right font-bold">{EXAM_TARGET}%</td>
              </tr>
              <tr>
                <td className="py-2 text-muted-foreground">Weighting</td>
                <td className="py-2 text-right font-bold">Section-proportional</td>
              </tr>
            </tbody>
          </table>
          <Text variant="note" placement="mt-3">Google does not publish a passing score.</Text>
        </div>
      </div>

      <div className="border-2 border-foreground p-4 mb-6 bg-muted">
        <Heading variant="label" placement="mb-2">SECTION WEIGHTS</Heading>
        <ul className="text-sm space-y-1">
          {sections.map((s) => (
            <li key={s.id}>{s.title}</li>
          ))}
        </ul>
      </div>

      <div className="border-2 border-foreground p-4 mb-6">
        <Heading variant="label" placement="mb-2">RULES</Heading>
        <ul className="text-sm space-y-1 text-muted-foreground">
          <li>→ The timer starts when you begin and keeps running if you close the app</li>
          <li>→ Flag a question to come back to it; Next flagged jumps between them</li>
          <li>→ You can end the exam at any time; unanswered questions count as wrong</li>
          <li>→ Results list every question with your answer, the right one and why</li>
          <li>→ Every result is saved, and can be reviewed again below or from Progress</li>
          <li className="hidden sm:list-item">→ Keys: A–D answer, F flag, ← → move</li>
        </ul>
      </div>

      <ActionButton variant="outlined" placement="w-full mb-6" onClick={() => startExam()}>
        Start exam →
      </ActionButton>

      <div className="border-2 border-foreground mb-6 overflow-x-auto">
        <SectionBar>PAST EXAMS</SectionBar>
        {history.length === 0 ? (
          <p className="p-3">No exam finished yet.</p>
        ) : (
          <ul className="divide-y divide-foreground list-none p-0 m-0">
            {history.map((exam, index) => (
              <li key={exam.id ?? index} className="p-3 flex flex-wrap items-center gap-x-4 gap-y-1">
                <span className="mr-auto">{exam.date} · {exam.correct}/{exam.total} ({exam.percent}%){exam.flagged && exam.flagged.length > 0 ? ` · ⚑ ${exam.flagged.length}` : ""}</span>
                {exam.id ? <a href={reviewHash(exam.id)} className="font-bold">Review →</a> : <span className="text-muted-foreground text-sm">No review</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
