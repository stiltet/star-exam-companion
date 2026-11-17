import Link from "next/link"
import type { ReactNode } from "react"
import { ActionButton, buttonClass } from "@/components/atoms/button"

// One half of the pair. href: a link to another page. onClick: a button that steps here (disabled at an end).
// null: nothing at this end, and the half stays empty so the other keeps its side. hint: a line under the button,
// such as the title of the topic it goes to.
export type Step = { href: string; hint?: string } | { onClick: () => void; disabled?: boolean; hint?: string } | null

// A molecule (it composes the step button): Previous and Next, the same pair in every section of the app (owner,
// 17 Nov). A phone reads "← Prev" and "Next →"; from sm up it reads "← Previous" and "Next →". kind says what is
// stepped through, so a screen reader hears "Previous lesson". middle: a button between the two, such as Reset.
// The parent places it (spacing above and below) as placement (rule 20).
export function StepNav({ kind, previous, next, middle, placement }: { kind: string; previous: Step; next: Step; middle?: ReactNode; placement?: string }) {
  if (!previous && !next && !middle) return null
  return (
    <nav aria-label={`Previous and next ${kind}`} className={["flex items-start justify-between gap-3", placement].filter(Boolean).join(" ")}>
      <Half direction="previous" kind={kind} step={previous} />
      {middle}
      <Half direction="next" kind={kind} step={next} />
    </nav>
  )
}

function Half({ direction, kind, step }: { direction: "previous" | "next"; kind: string; step: Step }) {
  const previous = direction === "previous"
  if (!step) return <div className="min-w-28 sm:min-w-36" aria-hidden="true" />
  const name = `${previous ? "Previous" : "Next"} ${kind}${step.hint ? `: ${step.hint}` : ""}`
  const text = (
    <>
      {previous && <span aria-hidden="true">←</span>}
      <span aria-hidden="true">
        <span className="sm:hidden">{previous ? "Prev" : "Next"}</span>
        <span className="hidden sm:inline">{previous ? "Previous" : "Next"}</span>
      </span>
      {!previous && <span aria-hidden="true">→</span>}
    </>
  )
  return (
    <div className={`min-w-0 flex flex-col ${previous ? "items-start" : "items-end"}`}>
      {"href" in step
        ? <Link href={step.href} aria-label={name} className={buttonClass("step")}>{text}</Link>
        : <button type="button" aria-label={name} disabled={step.disabled} onClick={step.onClick} className={buttonClass("step")}>{text}</button>}
      {step.hint && <span aria-hidden="true" className={`mt-1 max-w-36 sm:max-w-56 truncate text-xs text-muted-foreground ${previous ? "text-left" : "text-right"}`}>{step.hint}</span>}
    </div>
  )
}

// The button between the two (Reset, End session): the same size as Previous and Next.
export function StepMiddle({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return <ActionButton variant="step" onClick={onClick}>{children}</ActionButton>
}
