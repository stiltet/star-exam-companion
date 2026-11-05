"use client"

import { useState } from "react"
import { ActionButton } from "@/components/atoms/button"
import { Heading } from "@/components/atoms/heading"
import { Select } from "@/components/atoms/select"
import { Text } from "@/components/atoms/text"
import { sendNow } from "@/components/outbox"
import { stopStoringVoice } from "@/components/voice-cache"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { resumePageFetches } from "@/lib/exam-header"

type Props = {
  exams: { id: string; title: string }[]
  current: string
}

// Switches the exam every device on this Mac studies. Each exam keeps its own scores and its own
// stored data, so a switch never mixes them and switching back finds everything where it was.
export function ExamSwitcher({ exams, current }: Props) {
  // The exam picked in the dropdown and waiting for the owner to confirm; null while none is.
  const [pending, setPending] = useState<string | null>(null)
  const [switching, setSwitching] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [loadFailed, setLoadFailed] = useState<string | null>(null)
  // The name the dialog shows is kept while it fades out, so it never flips to the old exam's.
  const [shown, setShown] = useState(current)
  const target = pending ?? shown
  const title = (id: string) => exams.find((exam) => exam.id === id)?.title ?? id

  async function loadSwitchedExam(exam: string) {
    if (!await resumePageFetches()) {
      setSwitching(false)
      setLoadFailed(exam)
      setMessage(`The Mac now serves ${title(exam)}, but this device could not update its offline worker. Try loading again.`)
      return
    }
    setLoadFailed(null)
    setMessage(`Switched to ${title(exam)}.`)
    // The home page of the new exam, as a full load, so every page, table and menu is the new exam's.
    window.setTimeout(() => window.location.assign("/"), 800)
  }

  async function switchExam(exam: string) {
    setSwitching(true)
    setLoadFailed(null)
    setMessage(`Switching to ${title(exam)}…`)
    // Answers still on this device reach the Mac first, while it still serves the exam they belong to.
    await sendNow()
    let ok = false
    try {
      const response = await fetch("/api/exam", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exam }),
      })
      ok = ((await response.json()) as { ok?: boolean }).ok === true
    } catch {
      // The Mac did not answer, or answered with no JSON: shown below as a failed switch.
    }
    if (!ok) {
      setSwitching(false)
      setMessage("The exam was not switched. Check that the Mac is reachable and that this exam's content is complete, then try again.")
      return
    }
    // Clips still downloading belong to the exam being left; the next page stores the new exam's. Only now, so a
    // failed switch leaves the voice downloads of the exam still studied running.
    stopStoringVoice()
    await loadSwitchedExam(exam)
  }

  return (
    <div className="mt-6">
      <Heading variant="label" placement="mb-4">SWITCH EXAM</Heading>
      <label className="sr-only" htmlFor="exam-choice">Exam</label>
      <Select
        id="exam-choice"
        value={pending ?? current}
        disabled={switching}
        onChange={(event) => {
          const picked = event.target.value === current ? null : event.target.value
          if (picked) setShown(picked)
          setPending(picked)
        }}
      >
        {exams.map((exam) => (
          <option key={exam.id} value={exam.id}>{exam.title}</option>
        ))}
      </Select>
      {/* Picking another exam asks at once. A tap outside, Escape or Cancel closes it and puts the dropdown back. */}
      <Dialog open={pending !== null} onOpenChange={(open) => { if (!open) setPending(null) }}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Switch every device to {title(target)}?</DialogTitle>
            <DialogDescription>
              Study, Practice, Voice Quiz, the Exam, Flashcards and Progress all show {title(target)} from now on, on every device. {title(current)} keeps its scores and comes back as you left it when you switch back. A device that is offline changes the next time it reaches the Mac.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <ActionButton variant="outlined" onClick={() => setPending(null)}>Cancel</ActionButton>
            <ActionButton variant="filled" onClick={() => { const chosen = pending; setPending(null); if (chosen) void switchExam(chosen) }}>Switch exam</ActionButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Announced as it changes, so a screen-reader user hears the progress and the outcome. */}
      <Text variant="muted" role={loadFailed ? "alert" : "status"} placement={message ? "mt-4" : "sr-only"}>{message ?? ""}</Text>
      {loadFailed && (
        <ActionButton variant="outlined" placement="mt-4" disabled={switching} onClick={() => {
          setSwitching(true)
          setMessage("Checking the offline worker…")
          void loadSwitchedExam(loadFailed)
        }}>Try loading again</ActionButton>
      )}
    </div>
  )
}
