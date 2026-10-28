"use client"

import { useEffect, useRef, useState } from "react"
import { saveAnswer } from "@/components/outbox"
import type { Question } from "@/lib/exam-data"
import { loadState, practiceKey, practicePlace, saveState } from "@/lib/resume"

type Props = {
  questions: Question[]
  // Which filter this list is, so each filter keeps its own place.
  filter: string
  sectionTitles: Record<string, string>
}

export function PracticeQuestionClient({ questions, filter, sectionTitles }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0)
  // Every choice made in this filter, by id, earlier visits included. Kept on the device with
  // the current question, and never shown (owner, 28 Oct).
  const [kept, setKept] = useState<Record<string, number>>({})
  // The choices made on this visit. Only these are shown: every visit, a reload included, opens
  // on question 1 with nothing answered, so no answer shows before it is given.
  const [picked, setPicked] = useState<Record<string, number>>({})
  const [unsaved, setUnsaved] = useState(0)
  const loaded = useRef(false)

  const question = questions[currentIndex]
  const section = { title: sectionTitles[question.sectionId] ?? `Section ${question.sectionId}` }
  const topic = { title: question.topicId }
  const selectedAnswer = picked[question.id] ?? null
  const showExplanation = selectedAnswer !== null
  const answeredCount = Object.keys(picked).length
  const correctCount = questions.filter((q) => picked[q.id] === q.correctIndex).length

  useEffect(() => {
    setKept(practicePlace(questions.map((q) => q.id), loadState(window.localStorage, practiceKey(filter))).picked)
    loaded.current = true
  }, [filter, questions])

  useEffect(() => {
    if (!loaded.current) return
    saveState(window.localStorage, practiceKey(filter), { id: question.id, picked: kept })
  }, [filter, question.id, kept])

  const handleAnswer = (index: number) => {
    if (selectedAnswer !== null) return
    setPicked((prev) => ({ ...prev, [question.id]: index }))
    setKept((prev) => ({ ...prev, [question.id]: index }))
    const wrong = index !== question.correctIndex
    void saveAnswer("practice", [question.id], wrong ? [question.id] : []).then((kept) => {
      if (!kept) setUnsaved((count) => count + 1)
    })
  }

  const handleNext = () => {
    if (currentIndex < questions.length - 1) setCurrentIndex(currentIndex + 1)
  }

  const handlePrev = () => {
    if (currentIndex > 0) setCurrentIndex(currentIndex - 1)
  }

  // Clears the screen, not the saved answers.
  const handleReset = () => {
    setCurrentIndex(0)
    setPicked({})
  }

  return (
    <div>
      {/* Progress */}
      <div className="border-2 border-foreground p-4 mb-6">
        <div className="flex justify-between text-sm">
          <span>
            Question {currentIndex + 1} of {questions.length}
          </span>
          <span>
            Score: {correctCount}/{answeredCount} (
            {answeredCount > 0 ? Math.round((correctCount / answeredCount) * 100) : 0}%)
          </span>
        </div>
        <div className="mt-2 h-2 border border-foreground">
          <div
            className="h-full bg-foreground"
            style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Question */}
      <div className="border-2 border-foreground mb-6">
        <div className="p-4 border-b border-foreground bg-muted">
          <div className="flex justify-between text-sm text-muted-foreground mb-2">
            <span>
              {section?.title} → {topic?.title}
            </span>
            <span className="uppercase">{question.difficulty}</span>
          </div>
          <p className="font-medium">{question.question}</p>
        </div>

        <div className="divide-y divide-foreground">
          {question.options.map((option, index) => {
            let className = "p-4 cursor-pointer hover:bg-muted"

            if (selectedAnswer !== null) {
              if (index === question.correctIndex) {
                className = "p-4 bg-foreground text-background"
              } else if (index === selectedAnswer) {
                className = "p-4 bg-muted line-through"
              } else {
                className = "p-4 text-muted-foreground"
              }
            }

            return (
              <button
                key={index}
                onClick={() => handleAnswer(index)}
                disabled={selectedAnswer !== null}
                className={`${className} w-full text-left flex gap-3`}
              >
                <span className="font-bold">{String.fromCharCode(65 + index)}.</span>
                <span>{option}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Explanation */}
      {showExplanation && (
        <div className="border-2 border-foreground mb-6">
          <div className="p-4 border-b border-foreground bg-foreground text-background">
            <span className="font-bold">
              {selectedAnswer === question.correctIndex ? "CORRECT" : "INCORRECT"} — EXPLANATION
            </span>
          </div>
          <div className="p-4">
            <p className="mb-4">{question.explanation}</p>

            <h3 className="font-bold mb-2">WHY OTHER OPTIONS ARE WRONG:</h3>
            <ul className="space-y-2 mb-4">
              {question.whyOthersWrong.map((reason, index) => (
                <li key={index} className="flex gap-2 text-sm">
                  <span className="text-muted-foreground font-bold">{String.fromCharCode(65 + index)}.</span>
                  <span>{reason}</span>
                </li>
              ))}
            </ul>

            {question.officialDoc && (
              <a
                href={question.officialDoc}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-muted-foreground"
              >
                [OFFICIAL DOC] → {question.officialDoc}
              </a>
            )}
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between gap-4">
        <button
          onClick={handlePrev}
          disabled={currentIndex === 0}
          className="border-2 border-foreground px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-foreground hover:text-background disabled:hover:bg-background disabled:hover:text-foreground"
        >
          ← PREVIOUS
        </button>
        <button onClick={handleReset} className="border-2 border-foreground px-4 py-2 hover:bg-muted">
          RESET
        </button>
        <button
          onClick={handleNext}
          disabled={currentIndex === questions.length - 1}
          className="border-2 border-foreground px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-foreground hover:text-background disabled:hover:bg-background disabled:hover:text-foreground"
        >
          NEXT →
        </button>
      </div>
      {unsaved > 0 && <p role="alert" className="mt-6 font-bold">{unsaved === 1 ? "1 answer was" : `${unsaved} answers were`} not saved. This device could not keep it and the Mac could not be reached.</p>}
    </div>
  )
}
