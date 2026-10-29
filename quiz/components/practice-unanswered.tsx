"use client"

import { useEffect, useState } from "react"
import { Text } from "@/components/atoms/text"
import { PracticeQuestionClient } from "@/components/practice-question-client"
import { refreshSnapshot } from "@/components/snapshot"
import type { Question } from "@/lib/exam-data"
import { mergeLines, readOutbox } from "@/lib/outbox"
import { answeredIds } from "@/lib/progress"
import { readSnapshot } from "@/lib/snapshot"
import type { ScoreLine } from "@/lib/learn"

// The Mac is asked once per page load, which refreshes the copy kept on this device; turning
// Unanswered on or off asks it nothing more (owner, 28 Oct: it was slow). The lines are then read
// from that kept copy each time, which also takes in the answers this device has since sent.
// null when there is no copy. A failed ask is forgotten, so the next use asks again.
let asked: Promise<void> | null = null
function loadLines(): Promise<ScoreLine[] | null> {
  asked ??= refreshSnapshot().then(
    () => undefined,
    () => {
      asked = null
    },
  )
  return asked.then(() => readSnapshot(window.localStorage)?.lines ?? null)
}

// Every question answered in any mode: the Mac's lines plus the answers still on this device, read
// again each time, so it works offline. null while loading, "none" when no lines can be had, so
// nothing can be filtered. Fixed once loaded, so a question answered on this visit stays listed.
function useAnswered(): Set<string> | "none" | null {
  const [answered, setAnswered] = useState<Set<string> | "none" | null>(null)
  useEffect(() => {
    let live = true
    void loadLines().then((lines) => {
      if (live) setAnswered(lines ? answeredIds(mergeLines(lines, readOutbox(window.localStorage))) : "none")
    })
    return () => {
      live = false
    }
  }, [])
  return answered
}

type Props = {
  // The questions of the chosen section or topic, or all of them.
  questions: Question[]
  filter: string
  sectionTitles: Record<string, string>
}

// Practice's Unanswered filter: the chosen questions never answered in any mode (owner, 28 Oct).
export function PracticeUnanswered({ questions, filter, sectionTitles }: Props) {
  const answered = useAnswered()
  if (!answered) return <Text variant="notice" role="status">Loading your answers…</Text>
  if (answered === "none") return <Text variant="notice" role="alert">Your answers cannot be loaded: the Mac cannot be reached and none are kept on this device yet. Try again when the Mac is reachable.</Text>
  const list = questions.filter((q) => !answered.has(q.id))
  if (list.length === 0) return <Text variant="notice" role="status">Every question in this filter has been answered at least once.</Text>
  return <PracticeQuestionClient questions={list} filter={filter} sectionTitles={sectionTitles} />
}

// A filter button's count with Unanswered on: how many of its questions are unanswered, or
// "…" until the answers load.
export function UnansweredCount({ ids }: { ids: string[] }) {
  const answered = useAnswered()
  return <>{answered && answered !== "none" ? ids.filter((id) => !answered.has(id)).length : "…"}</>
}
