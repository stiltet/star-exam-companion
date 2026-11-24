import Link from "next/link"
import type { ReactNode } from "react"
import { ArrowLeft, ArrowRight } from "lucide-react"
import { ActionButton, buttonClass } from "@/components/atoms/button"

// One half of the pair: href (a link) or onClick (a button, disabled at an end); null keeps the other half on its side.
export type Step = { href: string; hint?: string } | { onClick: () => void; disabled?: boolean; hint?: string } | null

// A molecule (it composes the step button): Previous and Next, the same pair in every section of the app (owner,
// 17 Nov). A phone reads "← Prev" and "Next →"; from sm up it reads "← Previous" and "Next →". kind says what is
// stepped through, so a screen reader hears "Previous lesson". middle: a button between the two, such as Reset.
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
      {previous && <ArrowLeft aria-hidden="true" size={18} />}
      {/* The words are drawn by CSS and the name comes from aria-label ("Previous question"), so the short word Prev on a phone
          is not a visible label that differs from the name (WCAG 2.5.3). data-step-label lets a test read what is drawn. */}
      <span aria-hidden="true" data-step-label className={previous ? "before:content-['Prev'] sm:before:content-['Previous']" : "before:content-['Next']"} />
      {!previous && <ArrowRight aria-hidden="true" size={18} />}
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

// The button between the two (Reset, End session): the same size as Previous and Next, but no minimum width, so three
// fit side by side on a phone. short: the word it shows on a phone, when the full one does not fit; label: its name.
export function StepMiddle({ onClick, label, short, children }: { onClick: () => void; label?: string; short?: string; children: ReactNode }) {
  return (
    <ActionButton variant="step" placement="min-w-0 sm:min-w-0" aria-label={label} onClick={onClick}>
      {short ? <><span className="sm:hidden">{short}</span><span className="hidden sm:inline">{children}</span></> : children}
    </ActionButton>
  )
}
