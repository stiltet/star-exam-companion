import { ActionLink } from "@/components/atoms/button"

type Step = { href: string; title: string } | null

// Previous and Next for a page in a sequence (a lesson, a course), the same pair at the top and the
// bottom of the page. Small, side by side, with no titles. On a phone the label is only Previous or Next (the kind stays for a screen reader), so both fit side by side. Its look,
// and its spacing above and below (top: 12px under the breadcrumb, 20px above the title; bottom: 24px
// above it), live here, so both pages match. An end of the sequence has no link, and its half stays empty.
// kind says what is stepped through, so a screen reader hears "Previous lesson" for the link it holds.
export function PageNav({ kind, previous, next, at }: { kind: "lesson" | "course"; previous: Step; next: Step; at: "top" | "bottom" }) {
  if (!previous && !next) return null
  return (
    <nav aria-label={`Previous and next ${kind}`} className={`flex items-center justify-between gap-3 ${at === "top" ? "mt-3 mb-5" : "mt-6"}`}>
      <div className="min-w-0">
        {previous && <ActionLink variant="control" href={previous.href} placement="whitespace-nowrap">← Previous<span className="sr-only sm:not-sr-only"> {kind}</span></ActionLink>}
      </div>
      <div className="min-w-0">
        {next && <ActionLink variant="control" href={next.href} placement="whitespace-nowrap">Next<span className="sr-only sm:not-sr-only"> {kind}</span> →</ActionLink>}
      </div>
    </nav>
  )
}
