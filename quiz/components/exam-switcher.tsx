"use client"

import { useState } from "react"
import { sendNow } from "@/components/outbox"
import { Button } from "@/components/ui/button"
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
  const [message, setMessage] = useState<string | null>(null)
  const title = (id: string) => exams.find((exam) => exam.id === id)?.title ?? id

  async function switchExam() {
    // Answers still on this device reach the Mac first, while it still serves the exam they belong to.
    await sendNow()
    let ok = false
    try {
      const response = await fetch("/api/exam", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exam: pending }),
      })
      ok = ((await response.json()) as { ok?: boolean }).ok === true
    } catch {
      // The Mac did not answer, or answered with no JSON: shown below as a failed switch.
    }
    if (!ok) {
      setMessage("The exam was not switched. Check that the Mac is reachable, then try again.")
      return
    }
    setMessage(`Switched to ${title(pending ?? current)}.`)
    // The home page of the new exam, as a full load, so every page, table and menu is the new exam's.
    window.setTimeout(() => window.location.assign("/"), 800)
  }

  return (
    <div className="mt-6">
      <h2 className="font-bold mb-4">SWITCH EXAM</h2>
      <label className="sr-only" htmlFor="exam-choice">Exam</label>
      <select
        id="exam-choice"
        value={pending ?? current}
        onChange={(event) => setPending(event.target.value === current ? null : event.target.value)}
        className="w-full sm:w-auto border-2 border-foreground bg-background text-foreground px-3 py-2"
      >
        {exams.map((exam) => (
          <option key={exam.id} value={exam.id}>{exam.title}</option>
        ))}
      </select>
      {/* Picking another exam asks at once. A tap outside, Escape or Cancel closes it and puts the dropdown back. */}
      <Dialog open={pending !== null} onOpenChange={(open) => { if (!open) setPending(null) }}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Switch every device to {title(pending ?? current)}?</DialogTitle>
            <DialogDescription>
              Study, Practice, Voice Quiz, the Exam, Flashcards and Progress all show {title(pending ?? current)} from now on, on every device. {title(current)} keeps its scores and comes back as you left it when you switch back. A device that is offline changes the next time it reaches the Mac.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPending(null)}>Cancel</Button>
            <Button onClick={() => { void switchExam(); setPending(null) }}>Switch exam</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Announced after the dialog closes, so a screen-reader user hears the outcome. */}
      <p role="status" aria-live="polite" className={message ? "mt-4" : "sr-only"}>{message ?? ""}</p>
    </div>
  )
}
