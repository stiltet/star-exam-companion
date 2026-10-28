"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { EXAM_TARGET, PRACTICE_TARGET, voiceProgress } from "@/lib/learn"
import { courseLabel, sectionLabel, examHistory, flashcardProgress, modeLines, practiceProgress, progressFigures, readingProgress, readingStatus } from "@/lib/progress"
import { COURSES } from "@/lib/reading"
import { readingTotals } from "@/components/reading-progress"
import { practiceItems, SECTION_OF } from "@/lib/questions"
import { reviewHash } from "@/lib/exam-review"
import { ResetProgress } from "@/components/reset-progress"
import { SectionBar } from "@/components/atoms/section-bar"
import { ActionButton } from "@/components/atoms/button"
import { sendNow, useWaiting } from "@/components/outbox"
import { useSnapshot } from "@/components/snapshot"
import { useConnection } from "@/components/connection-status"
import { useOfflineStatus } from "@/components/offline"
import { useVoiceStored } from "@/components/voice-cache"

type SectionStat = {
  id: string
  title: string
  weight: number
  topicCount: number
}

type Props = {
  stats: {
    sections: SectionStat[]
  }
}

const cell = "px-2 py-3 sm:p-3"
// A Saving value and its button in one cell, held at the right edge. On desktop, where there is
// room, every button and value has one width, so the buttons line up ("This device" is the
// longest value).
const valueRow = "flex items-center justify-end gap-3 text-right"
const value = "font-bold sm:min-w-[11ch]"
const buttonFirst = "shrink-0 sm:order-first sm:w-36"
const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0)
// One row of a two-column table: a short label, and its value kept on one line.
function Row({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <tr className={last ? "" : "border-b border-foreground"}>
      <th scope="row" className="px-2 py-3 sm:p-3 text-left font-normal text-muted-foreground">{label}</th>
      <td className="px-2 py-3 sm:p-3 text-right font-bold whitespace-nowrap">{value}</td>
    </tr>
  )
}

const minutes = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`

export function ProgressClient({ stats }: Props) {
  const { snapshot, from, broken, lines } = useSnapshot()
  const { waiting, rejected, reasons } = useWaiting()
  const connection = useConnection()
  const offline = useOfflineStatus()
  const voiceStored = useVoiceStored(snapshot?.voice)
  const [sendNote, setSendNote] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const items = snapshot?.items ?? []
  const sections = snapshot?.sections ?? []
  // A copy saved before questions carried a course still groups by the exam-guide section.
  const byCourse = items.some((item) => item.course)
  const voiceSections = byCourse
    ? COURSES.map((course) => ({ id: Number(course.id), title: courseLabel(course.id), weight: 0 }))
    : sections
  const voice = voiceProgress(items, modeLines(lines, "round"), voiceSections, byCourse ? (item, id) => Number(item.course) === id : undefined)
  const pool = practiceItems(items)
  const practice = practiceProgress(pool, lines, sections)
  const voiceFigures = progressFigures(voice)
  const practiceFigures = progressFigures(practice)
  const exams = examHistory(lines)
  const retakes = examHistory(lines, "retake")
  const cards = flashcardProgress(snapshot?.terms ?? [], lines)
  const readings = readingProgress(lines)
  const [totals, setTotals] = useState<Record<string, number>>({})
  useEffect(() => setTotals(readingTotals()), [])
  const accuracy = voiceFigures.correctOfAll
  const canReset = broken === null

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
    <div>
      <h1 className="sr-only text-2xl font-bold mb-2">PROGRESS</h1>
      <p className="text-muted-foreground mb-8">Track completion by course and by section. No charts, only tables and percentages.</p>

      {broken && (
        <p role="alert" className="mb-6 font-bold">
          The glossary row “{broken.row}” cannot be read. {broken.error}. Progress is not shown until it is fixed.
        </p>
      )}
      {snapshot && snapshot.skippedLines > 0 && (
        <p role="alert" className="mb-6 font-bold">
          {snapshot.skippedLines} saved {snapshot.skippedLines === 1 ? "answer" : "answers"} could not be read and {snapshot.skippedLines === 1 ? "is" : "are"} left out of these figures.
        </p>
      )}

      <div className="border-2 border-foreground mb-6 overflow-x-auto">
        <SectionBar>SAVING</SectionBar>
        <table className="w-full text-xs sm:text-sm sm:whitespace-nowrap">
          <tbody>
            <tr className="border-b border-foreground">
              <td className={`${cell} text-muted-foreground sm:w-full`}>Waiting to send</td>
              {/* Phone: value, then button. Desktop: the button left of the value, which keeps the right edge. */}
              <td className={cell} colSpan={2}>
                <div className={valueRow}>
                  <span className={`${value} whitespace-nowrap`} aria-live="polite">{waiting}</span>
                  <ActionButton variant="toggle" placement={buttonFirst} disabled={sending} onClick={() => void send()}>Send now</ActionButton>
                </div>
              </td>
            </tr>
            {rejected > 0 && (
              <tr className="border-b border-foreground">
                <td className={`${cell} text-muted-foreground sm:w-full`}>Refused by the Mac</td>
                <td className={cell} colSpan={2}>
                  <div className={valueRow}>
                    <span className={`${value} whitespace-nowrap`}>{rejected}</span>
                    <ActionButton variant="toggle" placement={buttonFirst} disabled={sending} onClick={() => void send(true)}>Retry refused</ActionButton>
                  </div>
                </td>
              </tr>
            )}
            <tr className="border-b border-foreground">
              <td className={`${cell} text-muted-foreground sm:w-full`}>Progress from</td>
              <td className={cell} colSpan={2}>
                <div className={valueRow}>
                  <span className={value} aria-live="polite">
                    {from === "mac" ? "Your Mac" : from === "device" ? "This device" : from === "loading" ? "Loading…" : "Nothing yet"}
                  </span>
                  <ActionButton variant="toggle" placement={buttonFirst} disabled={connection.busy} onClick={connection.update}>
                    {connection.busy ? "Updating…" : "Update now"}
                  </ActionButton>
                </div>
              </td>
            </tr>
            <tr className="border-b border-foreground">
              <td className={`${cell} text-muted-foreground sm:w-full`}>Secure</td>
              <td className={`${cell} text-right font-bold`} colSpan={2}>{offline === null ? "…" : offline.secure ? "Yes" : "No: offline mode needs https://"}</td>
            </tr>
            <tr className="border-b border-foreground">
              <td className={`${cell} text-muted-foreground sm:w-full`}>Offline</td>
              <td className={`${cell} text-right font-bold`} colSpan={2}>{offline === null ? "…" : offline.ready ? "Ready" : offline.error ? <span title={offline.error}>Not ready: the offline worker did not load</span> : "Not ready"}</td>
            </tr>
            <tr>
              <td className={`${cell} text-muted-foreground sm:w-full`}>Voice for offline</td>
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

      <div className="border-2 border-foreground mb-6 overflow-x-auto">
        <SectionBar>VOICE QUIZ</SectionBar>
        <table className="w-full text-xs sm:text-sm">
          <tbody>
            <Row label="Answered" value={`${voiceFigures.answered} / ${voiceFigures.total} · ${voiceFigures.answeredPercent}%`} />
            <Row label="Correct (of answered)" value={`${voice.correct} · ${voiceFigures.correctOfAnswered}%`} />
            <Row label="Correct (of all)" value={`${voice.correct} · ${voiceFigures.correctOfAll}%`} />
            <Row label="Target" value={`${PRACTICE_TARGET}% · gap ${voiceFigures.gap}%`} last />
          </tbody>
        </table>
        <table className="w-full text-xs sm:text-sm border-t border-foreground">
          <thead>
            <tr className="border-b border-foreground">
              <th className="text-left px-2 py-3 sm:p-3">{byCourse ? "COURSE" : "SECTION"}</th>
              <th className="text-right px-2 py-3 sm:p-3">ANSWERED</th>
              <th className="text-right px-2 py-3 sm:p-3">CORRECT</th>
            </tr>
          </thead>
          <tbody>
            {voice.sections.map((section) => (
              <tr key={section.id} className="border-b border-foreground">
                <td className="px-2 py-3 sm:p-3">{byCourse ? section.title : sectionLabel(section.id, section.weight)}</td>
                <td className="px-2 py-3 sm:p-3 text-right whitespace-nowrap">{section.asked}/{section.total}</td>
                <td className="px-2 py-3 sm:p-3 text-right whitespace-nowrap">{section.correct}/{section.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="border-2 border-foreground mb-6 overflow-x-auto">
        <SectionBar>PRACTICE</SectionBar>
        <table className="w-full text-xs sm:text-sm">
          <thead>
            <tr className="border-b border-foreground">
              <th className={`text-left ${cell}`}>SECTION</th>
              <th className={`text-right ${cell}`}>ANSWERED</th>
              <th className={`text-right ${cell}`}>CORRECT</th>
            </tr>
          </thead>
          <tbody>
            {practice.sections.map((section) => (
              <tr key={section.id} className="border-b border-foreground">
                <td className={cell}>{sectionLabel(section.id, section.weight)}</td>
                <td className={`${cell} text-right whitespace-nowrap`}>{section.asked}/{section.total}</td>
                <td className={`${cell} text-right whitespace-nowrap`}>{section.correct}/{section.total}</td>
              </tr>
            ))}
            <tr>
              <td className={`${cell} font-bold`}>All</td>
              <td className={`${cell} text-right font-bold whitespace-nowrap`}>{practice.asked}/{practice.total}</td>
              <td className={`${cell} text-right font-bold whitespace-nowrap`}>{practice.correct}/{practice.total} · {practiceFigures.correctOfAll}%</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="border-2 border-foreground mb-6 overflow-x-auto">
        <SectionBar>EXAMS</SectionBar>
        {exams.length === 0 ? (
          <p className={cell}>No exam finished yet.</p>
        ) : (
          <table className="w-full text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-foreground">
                <th className={`text-left ${cell}`}>DATE</th>
                <th className={`text-right ${cell}`}>SCORE</th>
                <th className={`text-right ${cell}`}>TIME</th>
                <th className={`text-right ${cell}`}>RESULT</th>
                <th className={`text-right ${cell}`}><span className="sr-only">Review</span></th>
              </tr>
            </thead>
            <tbody>
              {exams.map((exam, index) => (
                <tr key={exam.id ?? index} className="border-b border-foreground">
                  <td className={cell}>{exam.date}</td>
                  <td className={`${cell} text-right`}>{exam.correct} / {exam.total} ({exam.percent}%)</td>
                  <td className={`${cell} text-right`}>{minutes(exam.seconds)}</td>
                  <td className={`${cell} text-right font-bold whitespace-nowrap`}>{exam.percent >= EXAM_TARGET ? "Passed" : "Not passed"}</td>
                  <td className={`${cell} text-right whitespace-nowrap`}>{exam.id ? <a href={`/exam${reviewHash(exam.id)}`} className="font-bold">Review →</a> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {retakes.length > 0 && (
        <div className="border-2 border-foreground mb-6 overflow-x-auto">
          <SectionBar>RETAKES</SectionBar>
          <p className={`${cell} text-muted-foreground border-b border-foreground`}>Retakes of missed and flagged questions. They do not count as practice exams.</p>
          <table className="w-full text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-foreground">
                <th className={`text-left ${cell}`}>DATE</th>
                <th className={`text-right ${cell}`}>SCORE</th>
                <th className={`text-right ${cell}`}>TIME</th>
                <th className={`text-right ${cell}`}><span className="sr-only">Review</span></th>
              </tr>
            </thead>
            <tbody>
              {retakes.map((exam, index) => (
                <tr key={exam.id ?? index} className="border-b border-foreground">
                  <td className={cell}>{exam.date}</td>
                  <td className={`${cell} text-right`}>{exam.correct} / {exam.total}</td>
                  <td className={`${cell} text-right`}>{minutes(exam.seconds)}</td>
                  <td className={`${cell} text-right whitespace-nowrap`}>{exam.id ? <a href={`/exam${reviewHash(exam.id)}`} className="font-bold">Review →</a> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="border-2 border-foreground mb-6 overflow-x-auto">
        <SectionBar>FLASHCARDS</SectionBar>
        <table className="w-full text-xs sm:text-sm">
          <tbody>
            <Row label="Marked" value={`${cards.marked} of ${cards.total} · ${pct(cards.marked, cards.total)}%`} />
            <Row label="Known (of all)" value={`${cards.known} of ${cards.total} · ${pct(cards.known, cards.total)}%`} last />
          </tbody>
        </table>
      </div>

      <div className="border-2 border-foreground mb-6 overflow-x-auto">
        <SectionBar>OFFICIAL COURSE TRACKING - READ ALOUD</SectionBar>
        <table className="w-full text-xs sm:text-sm">
          <tbody>
            {COURSES.map((course, index) => {
              const done = readings[course.id]
              // The state only: with the last day read too, the row ran wider than a phone.
              const value = readingStatus(done?.read.length ?? 0, totals[course.id])
              return <Row key={course.id} label={`Course ${course.id}`} value={value} last={index === COURSES.length - 1} />
            })}
          </tbody>
        </table>
      </div>

      {/* Overall Summary */}
      <div className="border-2 border-foreground mb-6 overflow-x-auto">
        <SectionBar>OVERALL SUMMARY</SectionBar>
        <table className="w-full text-xs sm:text-sm">
          <tbody>
            <Row label="Voice Quiz answered" value={`${voice.asked} of ${voice.total} · ${voiceFigures.answeredPercent}%`} />
            <Row label="Voice Quiz correct (of all)" value={`${voice.correct} of ${voice.total} · ${accuracy}%`} last />
          </tbody>
        </table>
      </div>

      {/* Target Score */}
      <div className="border-2 border-foreground p-4 mb-6 bg-muted">
        <div className="flex justify-between items-center">
          <span className="font-bold">TARGET SCORE</span>
          <span className="text-2xl font-bold">{PRACTICE_TARGET}%</span>
        </div>
        <div className="mt-2 text-sm text-muted-foreground">
          Voice Quiz correct (of all): {accuracy}% · gap {voiceFigures.gap}%
        </div>
      </div>

      {/* Section Breakdown */}
      <div className="border-2 border-foreground mb-6 overflow-x-auto">
        <SectionBar variant="muted">SECTION BREAKDOWN</SectionBar>
        <table className="w-full text-xs sm:text-sm">
          <thead>
            <tr className="border-b border-foreground">
              <th className="text-left px-2 py-3 sm:p-3">SECTION</th>
              <th className="text-right px-2 py-3 sm:p-3">TOPICS</th>
              <th className="text-right px-2 py-3 sm:p-3">QUESTIONS</th>
            </tr>
          </thead>
          <tbody>
            {stats.sections.map((section, index) => (
              <tr key={section.id} className="border-b border-foreground">
                <td className="px-2 py-3 sm:p-3">
                  <Link href={`/study/${section.id}`}>{sectionLabel(index + 1, section.weight)}</Link>
                </td>
                <td className="px-2 py-3 sm:p-3 text-right">{section.topicCount}</td>
                <td className="px-2 py-3 sm:p-3 text-right">{pool.filter((item) => String(item.section) === SECTION_OF[section.id]).length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Weak Areas */}
      <div className="border-2 border-foreground mb-6 overflow-x-auto">
        <SectionBar variant="muted">RECOMMENDED FOCUS</SectionBar>
        <div className="p-4">
          {accuracy < PRACTICE_TARGET ? (
            <ul className="space-y-2 text-sm">
              <li>→ Target accuracy is {PRACTICE_TARGET}%. Focus on understanding concepts, not memorization.</li>
              <li>→ Review topics where you consistently answer incorrectly.</li>
              <li>→ Pay attention to "Common Traps" in each topic page.</li>
              <li>→ Take full practice exams to build time management skills.</li>
            </ul>
          ) : (
            <p className="text-sm">Your accuracy meets the target. Continue practicing to maintain readiness.</p>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-4 mb-6">
        <Link
          href="/practice"
          className="border-2 border-foreground px-4 py-2 no-underline hover:bg-foreground hover:text-background"
        >
          PRACTICE QUESTIONS →
        </Link>
        <Link
          href="/exam"
          className="border-2 border-foreground px-4 py-2 no-underline hover:bg-foreground hover:text-background"
        >
          TAKE EXAM →
        </Link>
        <Link
          href="/flashcards"
          className="border-2 border-foreground px-4 py-2 no-underline hover:bg-foreground hover:text-background"
        >
          FLASHCARDS →
        </Link>
        <Link
          href="/voice"
          className="border-2 border-foreground px-4 py-2 no-underline hover:bg-foreground hover:text-background"
        >
          VOICE QUIZ →
        </Link>
      </div>

      <div className="border-t border-foreground pt-6">
        {canReset && <ResetProgress />}
        <p className="text-xs text-muted-foreground">
          Your progress is saved on the Mac as you go and backed up at the end of each study day. Clearing this browser does not lose it, and a reset keeps a copy first.
        </p>
      </div>
    </div>
  )
}
