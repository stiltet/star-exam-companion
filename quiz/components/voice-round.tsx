"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { CHANGED } from "@/components/outbox"
import { useSnapshot } from "@/components/snapshot"
import { VoiceQuiz } from "@/components/voice-quiz"
import type { RoundItem } from "@/lib/learn"
import { mergeLines, readOutbox } from "@/lib/outbox"
import { voiceRound } from "@/lib/progress"
import { readSnapshot } from "@/lib/snapshot"

// Builds the round on the device from the Mac's copy and the answers not yet sent, so it works offline.
export function VoiceRound() {
  const { snapshot, from, broken } = useSnapshot()
  const [round, setRound] = useState<RoundItem[] | null>(null)
  const [built, setBuilt] = useState(0)
  // Which questions the round was built from, and whether an answer has been given since.
  const builtFrom = useRef<string | null>(null)
  const answered = useRef(false)
  const signature = useMemo(() => (snapshot ? `${snapshot.namesChecked}|${JSON.stringify(snapshot.items)}` : null), [snapshot])

  useEffect(() => {
    const changed = () => {
      answered.current = true
    }
    window.addEventListener(CHANGED, changed)
    return () => window.removeEventListener(CHANGED, changed)
  }, [])

  // New questions from the Mac replace a round nobody has answered in yet; a round in progress
  // keeps its questions until the next visit.
  useEffect(() => {
    if (round === null || signature === null || builtFrom.current === null) return
    if (signature !== builtFrom.current && !answered.current) setRound(null)
  }, [signature, round])

  // Taken once per visit, from the saved answers read at that moment, so a question already
  // answered right is left out. Answers given during the round must not reshuffle it.
  useEffect(() => {
    if (round !== null || !snapshot || from === "loading") return
    const kept = readSnapshot(window.localStorage) ?? snapshot
    builtFrom.current = signature
    setRound(voiceRound(snapshot.items, mergeLines(kept.lines, readOutbox(window.localStorage))))
    setBuilt((count) => count + 1)
  }, [round, snapshot, from, signature])

  const heading = <h1 className="sr-only text-2xl font-bold mb-4">Voice Quiz</h1>
  if (broken) return <div>{heading}<p>The glossary row “{broken.row}” cannot be read. {broken.error}.</p></div>
  if (from === "loading" || (snapshot && round === null)) return <div>{heading}<p aria-live="polite">Loading the questions…</p></div>
  if (!snapshot || !round) return <div>{heading}<p>The questions are not on this device yet. Open the quiz once at home, on the Mac&apos;s Wi-Fi.</p></div>
  return <VoiceQuiz key={built} round={round} total={snapshot.items.length} namesChecked={snapshot.namesChecked} voice={snapshot.voice} sections={snapshot.sections} />
}
