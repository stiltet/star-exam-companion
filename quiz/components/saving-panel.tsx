"use client"

import { useState } from "react"
import { SectionBar } from "@/components/atoms/section-bar"
import { ActionButton } from "@/components/atoms/button"
import { StatusCell, StatusLabel, StatusList, StatusNote, StatusRow, StatusTable, StatusValue } from "@/components/atoms/status-table"
import { sendNow, useWaiting } from "@/components/outbox"
import { useSnapshot } from "@/components/snapshot"
import { useOfflineStatus } from "@/components/offline"
import { useVoiceStored } from "@/components/voice-cache"
import type { ConnectionState } from "@/components/connection-status"
import { STATIC_DEMO } from "@/lib/static-demo"

// A Saving value and its button in one cell, held at the right edge. On desktop, where there is
// room, every button and value has one width, so the buttons line up ("This device" is the
// longest value). The look of the table lives in the status table atoms; this file only places.
const valueRow = "flex items-center justify-end gap-3 text-right"
const buttonFirst = "shrink-0 sm:order-first sm:w-28"

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
      <StatusTable>
        <StatusRow>
          <StatusLabel>Waiting to send</StatusLabel>
          <StatusCell>
            <div className={valueRow}>
              <StatusValue nowrap>0</StatusValue>
              <ActionButton variant="compact" placement={buttonFirst} disabled>Send now</ActionButton>
            </div>
          </StatusCell>
        </StatusRow>
        <StatusRow last>
          <StatusLabel>Progress from</StatusLabel>
          <StatusCell>
            <div className={valueRow}>
              <StatusValue>Demo</StatusValue>
              <ActionButton variant="compact" placement={buttonFirst} disabled>Update now</ActionButton>
            </div>
          </StatusCell>
        </StatusRow>
      </StatusTable>
      <StatusNote role="status">This is the online demo: there is no Mac behind it, so nothing is saved or sent. These values are fixed. Run the quiz on your own Mac to see the real ones.</StatusNote>
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
      <StatusTable>
        <StatusRow>
          <StatusLabel>Waiting to send</StatusLabel>
          {/* Phone: value, then button. Desktop: the button left of the value, which keeps the right edge. */}
          <StatusCell>
            <div className={valueRow}>
              <StatusValue nowrap live>{waiting}</StatusValue>
              <ActionButton variant="compact" placement={buttonFirst} disabled={sending} onClick={() => void send()}>Send now</ActionButton>
            </div>
          </StatusCell>
        </StatusRow>
        {rejected > 0 && (
          <StatusRow>
            <StatusLabel>Refused by the Mac</StatusLabel>
            <StatusCell>
              <div className={valueRow}>
                <StatusValue nowrap>{rejected}</StatusValue>
                <ActionButton variant="compact" placement={buttonFirst} disabled={sending} onClick={() => void send(true)}>Retry refused</ActionButton>
              </div>
            </StatusCell>
          </StatusRow>
        )}
        <StatusRow>
          <StatusLabel>Progress from</StatusLabel>
          <StatusCell>
            <div className={valueRow}>
              <StatusValue live>
                {from === "mac" ? "Your Mac" : from === "device" ? "This device" : from === "loading" ? "Loading…" : "Nothing yet"}
              </StatusValue>
              <ActionButton variant="compact" placement={buttonFirst} disabled={connection.busy} onClick={connection.update}>
                {connection.busy ? "Updating…" : "Update now"}
              </ActionButton>
            </div>
          </StatusCell>
        </StatusRow>
        <StatusRow>
          <StatusLabel>Secure / Offline</StatusLabel>
          <StatusCell strong>
            {offline === null ? "…" : (
              <span title={offline.error ?? undefined}>
                {offline.secure ? "Yes" : "No"} / {offline.ready ? "Ready" : "Not ready"}
                {!offline.secure && ": needs https://"}
                {offline.secure && offline.error && ": the offline worker did not load"}
              </span>
            )}
          </StatusCell>
        </StatusRow>
        <StatusRow last>
          <StatusLabel>Voice for offline</StatusLabel>
          <StatusCell strong>{voiceStored ? `${voiceStored.stored} of ${voiceStored.total} lines` : !("caches" in window) ? "Needs https://" : "…"}</StatusCell>
        </StatusRow>
      </StatusTable>
      {rejected > 0 && (
        <StatusNote>
          <p>Refused answers are kept on this device. Retry to send them again without losing or duplicating answers.</p>
          <StatusList>
            {[...new Set(Object.values(reasons))].map((reason) => <li key={reason}>{reason}</li>)}
          </StatusList>
        </StatusNote>
      )}
      {sendNote && <StatusNote role="status">{sendNote}</StatusNote>}
    </div>
  )
}
