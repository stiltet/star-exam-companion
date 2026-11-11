import { ActionLink } from "@/components/atoms/button"

type Step = { href: string; title: string } | null

// Previous and Next for a page in a sequence (a lesson, a course), the same pair at the top and the
// bottom of the page. Small, side by side, with no titles. On a phone the label is only Previous or Next (the kind stays for a screen reader), so both fit side by side. Its look
// lives here; the parent places it. An end of the sequence has no link, and its half stays empty.
// kind says what is stepped through, so a screen reader hears "Previous lesson" for the link it holds.
export function PageNav({ kind, previous, next, placement = "" }: { kind: "lesson" | "course"; previous: Step; next: Step; placement?: string }) {
  if (!previous && !next) return null
  return (
    <nav aria-label={`Previous and next ${kind}`} className={`flex items-center justify-between gap-3 ${placement}`.trim()}>
      <div className="min-w-0">
        {previous && <ActionLink variant="control" href={previous.href} placement="whitespace-nowrap">← Previous<span className="sr-only sm:not-sr-only"> {kind}</span></ActionLink>}
      </div>
      <div className="min-w-0">
        {next && <ActionLink variant="control" href={next.href} placement="whitespace-nowrap">Next<span className="sr-only sm:not-sr-only"> {kind}</span> →</ActionLink>}
      </div>
    </nav>
  )
}
