"use client"

import { useState } from "react"
import { sendNow } from "@/components/outbox"
import { clearDeviceSessions } from "@/lib/resume"
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

export function ResetProgress() {
  const [message, setMessage] = useState<string | null>(null)

  async function reset() {
    // Answers still on this device go first, so the backup holds them too.
    const sent = await sendNow()
    if (!sent.reached || sent.waiting > 0 || sent.rejected > 0 || sent.storageError) {
      setMessage("Reset needs every answer saved on the Mac. Retry any refused answers first. Nothing was deleted.")
      return
    }
    let body: { ok?: boolean; backup?: string | null } = {}
    try {
      const response = await fetch("/api/scores/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: true }),
      })
      body = (await response.json()) as typeof body
    } catch {
      // The Mac did not answer, or answered with no JSON: shown below as a failed reset.
      body = {}
    }
    if (!body.ok) {
      setMessage("Reset failed. Nothing was deleted.")
      return
    }
    clearDeviceSessions(window.localStorage)
    setMessage(body.backup ? "Progress reset. A copy of your old scores is kept and backed up at the end of the day." : "Progress reset. There were no scores to keep.")
    // A full reload fetches the emptied scores for every table on the page.
    window.setTimeout(() => window.location.reload(), 1500)
  }

  return (
    <div className="mb-6">
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <button type="button" className="border-2 border-foreground px-4 py-2">Reset progress</button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset all progress to 0?</AlertDialogTitle>
            <AlertDialogDescription>
              Every Voice Quiz, Practice, Exam, Flashcards and Read Aloud result is cleared, and each mode starts from the beginning. Answers still on this device are sent first, and a copy of your current scores is kept, so nothing is lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void reset()}>Reset progress</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* Announced after the dialog closes, so a screen-reader user hears the outcome. */}
      <p role="status" aria-live="polite" className={message ? "mt-4" : "sr-only"}>{message ?? ""}</p>
    </div>
  )
}
