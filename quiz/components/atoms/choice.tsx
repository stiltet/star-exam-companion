import type { ReactNode } from "react"

// The quiz's answer-choice atom: one lettered option of an exam question. Its look
// lives here; the parent lists the options.
// idle and selected: while answering. right, wrong and missed: in a review, the right answer
// chosen, the wrong one chosen, and the right one when it was not chosen. A review choice is not
// a button.
export type ChoiceState = "idle" | "selected" | "right" | "wrong" | "missed" | "plain"

const BASE = "flex w-full gap-3 p-4 text-left"

const LOOK: Record<ChoiceState, string> = {
  idle: "bg-background text-foreground hover:bg-muted",
  selected: "bg-foreground text-background",
  right: "border-l-8 border-l-correct font-bold",
  wrong: "border-l-8 border-l-incorrect",
  missed: "border-l-8 border-l-correct font-bold",
  plain: "border-l-8 border-l-transparent",
}

const SAID: Partial<Record<ChoiceState, string>> = { right: "Your answer ✓", wrong: "Your answer ✗", missed: "Right answer" }

export function Choice({ index, state, onSelect, children }: { index: number; state: ChoiceState; onSelect?: () => void; children: ReactNode }) {
  const letter = <span className="font-bold shrink-0">{String.fromCharCode(65 + index)}.</span>
  const said = SAID[state]
  if (!onSelect) {
    return (
      <div className={`${BASE} ${LOOK[state]}`}>
        {letter}
        <span className="min-w-0 flex-1">{children}</span>
        {said && <span className={`shrink-0 text-xs font-bold uppercase ${state === "wrong" ? "text-incorrect" : "text-correct"}`}>{said}</span>}
      </div>
    )
  }
  return (
    <button type="button" onClick={onSelect} aria-pressed={state === "selected"} className={`${BASE} ${LOOK[state]}`}>
      {letter}
      <span className="min-w-0">{children}</span>
    </button>
  )
}
