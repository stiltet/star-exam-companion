// The quiz's question-navigator cell: one numbered square in the exam's navigator. Its
// look lives here; the parent lays the cells out. Answered fills it; flagged adds a flag-coloured
// corner, so a flag shows on an answered question too; current gets a thick ring.
export function NavCell({ number, answered, flagged, current, onSelect }: { number: number; answered: boolean; flagged: boolean; current: boolean; onSelect: () => void }) {
  const fill = answered ? "bg-foreground text-background" : "bg-background text-foreground"
  const ring = current ? "outline-4 outline-offset-2 outline-foreground" : ""
  const label = `Question ${number}${answered ? ", answered" : ", unanswered"}${flagged ? ", flagged" : ""}${current ? ", current" : ""}`
  return (
    <button type="button" onClick={onSelect} aria-label={label} aria-current={current ? "step" : undefined} className={`relative size-9 border-2 border-foreground text-xs font-bold ${fill} ${ring}`}>
      {number}
      {flagged && <span aria-hidden="true" className="absolute top-0 right-0 size-3 bg-flag border-b-2 border-l-2 border-foreground" />}
    </button>
  )
}
