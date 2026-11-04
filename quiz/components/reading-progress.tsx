"use client"

import { useEffect, useState } from "react"
import { StatusLink } from "@/components/atoms/status-link"
import { useSnapshot } from "@/components/snapshot"
import { readingProgress, readingState, readingStatus } from "@/lib/progress"
import type { PageSummary } from "@/lib/reading-view"

// Each course's number of readings, kept on this device when its list is opened. The list comes
// from Google's bundle, which Progress cannot reach offline, so Progress shows "n of N" only
// for courses opened here before. Counts only, no study data, so a progress reset keeps them.
const TOTALS_KEY = "quiz-reading-totals"

export function readingTotals(): Record<string, number> {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(TOTALS_KEY) ?? "{}")
    if (!value || typeof value !== "object" || Array.isArray(value)) return {}
    // Only whole positive counts: anything else stored there is ignored, never shown.
    return Object.fromEntries(Object.entries(value).filter(([, total]) => Number.isInteger(total) && (total as number) > 0)) as Record<string, number>
  } catch {
    // Storage refused or unreadable: the counts show without their totals.
    return {}
  }
}

function keepTotal(course: string, total: number) {
  try {
    window.localStorage.setItem(TOTALS_KEY, JSON.stringify({ ...readingTotals(), [course]: total }))
  } catch {
    // A private window keeps no total; the list itself still shows what is read.
  }
}

// A course's readings with a tick beside each one read, and how many are read.
export function ReadingList({ course, pages }: { course: string; pages: PageSummary[] }) {
  const { lines } = useSnapshot()
  const read = new Set(readingProgress(lines)[course]?.read ?? [])
  useEffect(() => keepTotal(course, pages.length), [course, pages.length])
  return (
    <>
      <p className="mb-4 font-bold">{readingStatus(pages.filter((page) => read.has(page.id)).length, pages.length)}</p>
      <div className="divide-y-2 divide-foreground border-2 border-foreground">
        {pages.map((page, index) => (
          <StatusLink key={page.id} href={`/read/${course}/${page.id}`} layout="row" state={read.has(page.id) ? "done" : "none"}>
            <span className="min-w-0 flex-1">
              <span className="font-bold">{index + 1}.</span> {page.title}
            </span>
            {read.has(page.id) && (
              <>
                <span aria-hidden="true">✓</span>
                <span className="sr-only">, read</span>
              </>
            )}
          </StatusLink>
        ))}
      </div>
    </>
  )
}

// One course on the overview, coloured by its state. The total comes from the Mac when it could
// read Google's bundle, else from this device; either way it is kept here for Progress.
export function CourseCard({ course, title, total }: { course: string; title: string; total?: number }) {
  const { lines } = useSnapshot()
  const [kept, setKept] = useState<number | undefined>(undefined)
  useEffect(() => {
    if (total !== undefined) keepTotal(course, total)
    setKept(total ?? readingTotals()[course])
  }, [course, total])
  const read = readingProgress(lines)[course]?.read.length ?? 0
  return (
    <StatusLink href={`/read/${course}`} layout="stack" state={readingState(read, kept)}>
      <span className="font-bold">Course {course}</span>: {title}
      <span className="block text-sm font-bold mt-1">{readingStatus(read, kept)}</span>
    </StatusLink>
  )
}
