"use client"

import { useEffect, useState } from "react"
import { Text } from "@/components/atoms/text"

const SKILLS_ORIGIN = "https://www.skills.google"

type CaptureMessage = {
  type: "star-reading"
  template: string
  pageId: string
  title: string
  text: string
}

function isCaptureMessage(value: unknown): value is CaptureMessage {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const message = value as Partial<CaptureMessage>
  return message.type === "star-reading" &&
    typeof message.template === "string" &&
    typeof message.pageId === "string" &&
    typeof message.title === "string" &&
    typeof message.text === "string"
}

export function PrivateReadingCapture({ packId, templates }: { packId: string; templates: string[] }) {
  const [status, setStatus] = useState("Open this page with the Send to Star bookmarklet from a signed-in Google Skills course.")

  useEffect(() => {
    if (!navigator.onLine) {
      setStatus("Saving a private copy needs this server. Your previously stored readings remain available offline.")
      return
    }
    const opener = window.opener
    if (!opener) return
    let live = true
    const receive = (event: MessageEvent<unknown>) => {
      if (!live || event.origin !== SKILLS_ORIGIN || event.source !== opener || !isCaptureMessage(event.data)) return
      const { template, pageId, title, text } = event.data
      if (!templates.includes(template)) {
        setStatus("This course is not one this exam saves private copies for.")
        return
      }
      setStatus("Saving the private copy on this server…")
      void fetch("/api/reading/private", {
        method: "POST",
        headers: { "content-type": "application/json", "x-quiz-exam": packId },
        body: JSON.stringify({ template, pageId, title, text }),
      }).then(async (response) => {
        const result: unknown = await response.json().catch(() => null)
        if (!live) return
        if (response.ok && result && typeof result === "object" && "ok" in result && result.ok === true) {
          setStatus("Saved the private reading on this server. You can close this tab.")
          return
        }
        const reason = result && typeof result === "object" && "reason" in result ? result.reason : undefined
        if (response.status === 409) setStatus("The quiz is set to another exam. Switch to Agentic Architect (bottom of the Progress page), then send the reading again.")
        else if (response.status === 413) setStatus("This course already holds as many private readings as it can. Delete some saved readings, then send this one again.")
        else if (reason === "reading") setStatus("This page was not saved: it is empty or longer than 1,000,000 characters. Select just the passage you want and try again.")
        else setStatus(`The server could not save this reading (HTTP ${response.status}).`)
      }).catch(() => {
        if (live) setStatus("The server could not save this reading. Check the local quiz and try again.")
      })
    }
    window.addEventListener("message", receive)
    opener.postMessage({ type: "star-reading-ready" }, SKILLS_ORIGIN)
    return () => {
      live = false
      window.removeEventListener("message", receive)
    }
  }, [packId, templates])

  return <Text variant="muted" role="status">{status}</Text>
}
