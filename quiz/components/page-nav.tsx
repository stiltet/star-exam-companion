import { StepNav } from "@/components/step-nav"

type Step = { href: string; title: string } | null

// Previous and Next for a page in a sequence (a lesson, a course): the app's one pair, StepNav. The title is not shown.
export function PageNav({ kind, previous, next, placement, where }: { kind: "lesson" | "course"; previous: Step; next: Step; placement?: string; where?: "top" | "bottom" }) {
  return <StepNav kind={kind} previous={previous ? { href: previous.href } : null} next={next ? { href: next.href } : null} placement={placement} where={where} />
}
