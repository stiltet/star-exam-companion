"use client"

import { useState } from "react"
import { SectionBar } from "@/components/atoms/section-bar"
import { ActionButton } from "@/components/atoms/button"
import { sendNow, useWaiting } from "@/components/outbox"
import { useSnapshot } from "@/components/snapshot"
import { useOfflineStatus } from "@/components/offline"
import { useVoiceStored } from "@/components/voice-cache"
import type { ConnectionState } from "@/components/connection-status"
import { STATIC_DEMO } from "@/lib/static-demo"

// One fixed height for every row, whether it holds a button or only text.
const cell = "h-11 px-2 sm:px-3"
// A Saving value and its button in one cell, held at the right edge. On desktop, where there is
// room, every button and value has one width, so the buttons line up ("This device" is the
// longest value).
const valueRow = "flex items-center justify-end gap-3 text-right"
const value = "font-bold sm:min-w-[11ch]"
const buttonFirst = "shrink-0 sm:order-first sm:w-28"
const label = `${cell} text-muted-foreground sm:w-full`

// Where the answers are saved and where the questions came from, with Send now and Update now.
// It opens from the status icon in the header: under it on a phone, in a dialog on a wider screen.
// The parent gives the connection, so the icon and this panel share one Update now.
export function SavingPanel({ connection }: { connection: ConnectionState }) {
  // The online demo has no Mac behind it: fixed values, and nothing to send.
  return STATIC_DEMO ? <DemoSaving /> : <LiveSaving connection={connection} />
}

function DemoSaving() {
  return (
    <div className="overflow-x-auto">
      <SectionBar variant="muted">OFFLINE / CONNECTION STATUS</SectionBar>
      <table className="w-full text-xs sm:text-sm sm:whitespace-nowrap">
        <tbody>
          <tr className="border-b border-foreground">
            <td className={label}>Waiting to send</td>
            <td className={cell} colSpan={2}>
              <div className={valueRow}>
                <span className={`${value} whitespace-nowrap`}>0</span>
                <ActionButton variant="compact" placement={buttonFirst} disabled>Send now</ActionButton>
              </div>
            </td>
          </tr>
          <tr>
            <td className={label}>Progress from</td>
            <td className={cell} colSpan={2}>
              <div className={valueRow}>
                <span className={value}>Demo</span>
                <ActionButton variant="compact" placement={buttonFirst} disabled>Update now</ActionButton>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      <p role="status" className="p-3 border-t border-foreground text-sm">This is the online demo: there is no Mac behind it, so nothing is saved or sent. These values are fixed. Run the quiz on your own Mac to see the real ones.</p>
    </div>
  )
}

function LiveSaving({ connection }: { connection: ConnectionState }) {
  const { snapshot, from } = useSnapshot()
  const { waiting, rejected, reasons } = useWaiting()
  const offline = useOfflineStatus()
  const voiceStored = useVoiceStored(snapshot?.voice)
  const [sendNote, setSendNote] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  async function send(retryRejected = false) {
    setSending(true)
    setSendNote("Sending…")
    try {
      const result = await sendNow(retryRejected)
      setSendNote(result.storageError
        ? "This device could not update its saving records. Keep its website data and retry."
        : !result.reached
          ? "The Mac could not be reached. Unsent answers stay on this device."
          : result.rejected > 0
            ? `${result.sent} sent. ${result.rejected} still refused; kept on this device. ${result.waiting} waiting to send.`
            : result.waiting > 0
              ? `${result.waiting} still waiting.`
              : "Everything is on the Mac.")
    } catch {
      // Report the failure in the saving status; local answers must not be discarded.
      setSendNote("Saving could not finish. Keep this device's website data and retry.")
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="overflow-x-auto">
      <SectionBar variant="muted">OFFLINE / CONNECTION STATUS</SectionBar>
      <table className="w-full text-xs sm:text-sm sm:whitespace-nowrap">
        <tbody>
          <tr className="border-b border-foreground">
            <td className={label}>Waiting to send</td>
            {/* Phone: value, then button. Desktop: the button left of the value, which keeps the right edge. */}
            <td className={cell} colSpan={2}>
              <div className={valueRow}>
                <span className={`${value} whitespace-nowrap`} aria-live="polite">{waiting}</span>
                <ActionButton variant="compact" placement={buttonFirst} disabled={sending} onClick={() => void send()}>Send now</ActionButton>
              </div>
            </td>
          </tr>
          {rejected > 0 && (
            <tr className="border-b border-foreground">
              <td className={label}>Refused by the Mac</td>
              <td className={cell} colSpan={2}>
                <div className={valueRow}>
                  <span className={`${value} whitespace-nowrap`}>{rejected}</span>
                  <ActionButton variant="compact" placement={buttonFirst} disabled={sending} onClick={() => void send(true)}>Retry refused</ActionButton>
                </div>
              </td>
            </tr>
          )}
          <tr className="border-b border-foreground">
            <td className={label}>Progress from</td>
            <td className={cell} colSpan={2}>
              <div className={valueRow}>
                <span className={value} aria-live="polite">
                  {from === "mac" ? "Your Mac" : from === "device" ? "This device" : from === "loading" ? "Loading…" : "Nothing yet"}
                </span>
                <ActionButton variant="compact" placement={buttonFirst} disabled={connection.busy} onClick={connection.update}>
                  {connection.busy ? "Updating…" : "Update now"}
                </ActionButton>
              </div>
            </td>
          </tr>
          <tr className="border-b border-foreground">
            <td className={label}>Offline</td>
            <td className={`${cell} text-right font-bold`} colSpan={2}>
              {offline === null ? "…" : !offline.secure ? "No: needs https://" : offline.ready ? "Ready" : offline.error ? <span title={offline.error}>Not ready: the offline worker did not load</span> : "Not ready"}
            </td>
          </tr>
          <tr>
            <td className={label}>Voice for offline</td>
            <td className={`${cell} text-right font-bold`} colSpan={2}>{voiceStored ? `${voiceStored.stored} of ${voiceStored.total} lines` : "Needs https://"}</td>
          </tr>
        </tbody>
      </table>
      {rejected > 0 && (
        <div className="p-3 border-t border-foreground text-sm">
          <p>Refused answers are kept on this device. Retry to send them again without losing or duplicating answers.</p>
          <ul className="mt-2 list-disc pl-5">
            {[...new Set(Object.values(reasons))].map((reason) => <li key={reason}>{reason}</li>)}
          </ul>
        </div>
      )}
      {sendNote && <p role="status" className="p-3 border-t border-foreground text-sm">{sendNote}</p>}
    </div>
  )
}
