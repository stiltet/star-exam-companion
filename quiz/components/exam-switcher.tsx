"use client"

import { useState } from "react"
import { sendNow } from "@/components/outbox"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

type Props = {
  exams: { id: string; title: string }[]
  current: string
}

// Switches the exam every device on this Mac studies. Each exam keeps its own scores and its own
// stored data, so a switch never mixes them and switching back finds everything where it was.
export function ExamSwitcher({ exams, current }: Props) {
  const [chosen, setChosen] = useState(current)
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
        body: JSON.stringify({ exam: chosen }),
      })
      ok = ((await response.json()) as { ok?: boolean }).ok === true
    } catch {
      // The Mac did not answer, or answered with no JSON: shown below as a failed switch.
    }
    if (!ok) {
      setMessage("The exam was not switched. Check that the Mac is reachable, then try again.")
      return
    }
    setMessage(`Switched to ${title(chosen)}.`)
    // The home page of the new exam, as a full load, so every page, table and menu is the new exam's.
    window.setTimeout(() => window.location.assign("/"), 800)
  }

  return (
    <div className="mt-6">
      <h2 className="font-bold mb-4">SWITCH EXAM</h2>
      <div className="flex flex-wrap gap-4 items-center">
        <label className="sr-only" htmlFor="exam-choice">Exam</label>
        <select
          id="exam-choice"
          value={chosen}
          onChange={(event) => setChosen(event.target.value)}
          className="border-2 border-foreground bg-background text-foreground px-3 py-2"
        >
          {exams.map((exam) => (
            <option key={exam.id} value={exam.id}>{exam.title}</option>
          ))}
        </select>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button type="button" disabled={chosen === current} className="border-2 border-foreground px-4 py-2 disabled:opacity-50">Switch exam</button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Switch every device to {title(chosen)}?</AlertDialogTitle>
              <AlertDialogDescription>
                Study, Practice, Voice Quiz, the Exam, Flashcards and Progress all show {title(chosen)} from now on, on every device. {title(current)} keeps its scores and comes back as you left it when you switch back. A device that is offline changes the next time it reaches the Mac.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => void switchExam()}>Switch exam</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
      {/* Announced after the dialog closes, so a screen-reader user hears the outcome. */}
      <p role="status" aria-live="polite" className={message ? "mt-4" : "sr-only"}>{message ?? ""}</p>
    </div>
  )
}
