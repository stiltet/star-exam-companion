"use client"

import { useState } from "react"
import { ActionButton } from "@/components/atoms/button"
import { Heading } from "@/components/atoms/heading"
import { Select } from "@/components/atoms/select"
import { sendNow } from "@/components/outbox"
import { stopStoringVoice } from "@/components/voice-cache"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"

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
  const title = (id: string) => exams.find((exam) => exam.id === id)?.title ?? id

  async function switchExam(target: string) {
    setSwitching(true)
    // Clips still downloading belong to the exam being left; the next page stores the new exam's.
    stopStoringVoice()
    setMessage(`Switching to ${title(target)}…`)
    // Answers still on this device reach the Mac first, while it still serves the exam they belong to.
    await sendNow()
    let ok = false
    try {
      const response = await fetch("/api/exam", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exam: target }),
      })
      ok = ((await response.json()) as { ok?: boolean }).ok === true
    } catch {
      // The Mac did not answer, or answered with no JSON: shown below as a failed switch.
    }
    if (!ok) {
      setSwitching(false)
      setMessage("The exam was not switched. Check that the Mac is reachable, then try again.")
      return
    }
    setMessage(`Switched to ${title(target)}.`)
    // The home page of the new exam, as a full load, so every page, table and menu is the new exam's.
    window.setTimeout(() => window.location.assign("/"), 800)
  }

  // The name the dialog shows is kept while it fades out, so it never flips to the old exam's.
  const [shown, setShown] = useState(current)
  const target = pending ?? shown

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
      <p role="status" aria-live="polite" className={message ? "mt-4" : "sr-only"}>{message ?? ""}</p>
    </div>
  )
}
