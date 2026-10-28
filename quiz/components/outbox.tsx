"use client"

import { useEffect, useState } from "react"
import { addToOutbox, newAnswer, type AnswerExtra, readOutbox, readRejected, readRejectionReasons, sendOutbox, type SendSummary } from "@/lib/outbox"
import { postAnswers } from "@/lib/save"
import type { Answer, Mode } from "@/lib/score"
import { absorbSent, readSnapshot, writeSnapshot } from "@/lib/snapshot"

export const CHANGED = "quiz-outbox-changed"
const RETRY_MS = 60_000

let sending: Promise<SendSummary> | null = null

// One send at a time; a second call waits for the one already on its way.
export function sendNow(retryRejected = false): Promise<SendSummary> {
  if (sending && retryRejected) return sending.then(() => sendNow(true))
  if (!sending) {
    const store = window.localStorage
    const before = [...new Map([...readOutbox(store), ...(retryRejected ? readRejected(store) : [])].map((answer) => [answer.id, answer])).values()]
    sending = sendOutbox(store, (answers) => postAnswers(answers), retryRejected)
      .then((result) => {
        const left = new Set([...readOutbox(store), ...readRejected(store)].map((answer) => answer.id))
        const snapshot = readSnapshot(store)
        if (snapshot && result.sent > 0) writeSnapshot(store, absorbSent(snapshot, before.filter((answer) => !left.has(answer.id))))
        return result
      })
      .finally(() => {
        sending = null
        window.dispatchEvent(new Event(CHANGED))
      })
  }
  return sending
}

// Saves one result on the device, then tries to send it. Returns false only when the device
// could not keep it and the Mac could not be reached either.
export function saveAnswer(mode: Mode, asked: string[], missed: string[], extra: AnswerExtra = {}): Promise<boolean> {
  return keepAnswer(newAnswer(mode, asked, missed, extra))
}

// The same, for an answer made with newAnswer, when the caller needs its id (a finished exam
// opens its own review by it).
export async function keepAnswer(answer: Answer): Promise<boolean> {
  if (addToOutbox(window.localStorage, answer)) {
    window.dispatchEvent(new Event(CHANGED))
    void sendNow()
    return true
  }
  const result = await postAnswers([answer])
  return result !== null && [...result.stored, ...result.duplicate].includes(answer.id)
}

export function waitingAnswers(): Answer[] {
  return typeof window === "undefined" ? [] : readOutbox(window.localStorage)
}

// The number of answers still on the device, kept current.
export function useWaiting(): { waiting: number; rejected: number; reasons: Record<string, string> } {
  const [counts, setCounts] = useState<{ waiting: number; rejected: number; reasons: Record<string, string> }>({ waiting: 0, rejected: 0, reasons: {} })
  useEffect(() => {
    const update = () => {
      const store = window.localStorage
      const reasons = readRejectionReasons(store)
      setCounts({
        waiting: readOutbox(store).length,
        rejected: readRejected(store).length,
        reasons: Object.fromEntries(readRejected(store).map((answer) => [answer.id, reasons[answer.id] ?? "No reason was recorded. Retry to ask the Mac."])),
      })
    }
    update()
    window.addEventListener(CHANGED, update)
    window.addEventListener("storage", update)
    return () => {
      window.removeEventListener(CHANGED, update)
      window.removeEventListener("storage", update)
    }
  }, [])
  return counts
}

// Sends on open, on return to the app, when the connection comes back, and every minute while
// answers wait. iOS has no Background Sync, so this runs only while the app is open.
export function OutboxSender() {
  useEffect(() => {
    const send = () => {
      if (readOutbox(window.localStorage).length > 0) void sendNow()
    }
    const visible = () => {
      if (document.visibilityState === "visible") send()
    }
    send()
    const timer = window.setInterval(send, RETRY_MS)
    window.addEventListener("online", send)
    document.addEventListener("visibilitychange", visible)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener("online", send)
      document.removeEventListener("visibilitychange", visible)
    }
  }, [])
  return null
}
