import { ActionLink } from "@/components/atoms/button"

type Step = { href: string; title: string } | null

// Previous and Next for a page in a sequence (a lesson, a course), the same pair at the top and the
// bottom of the page. Its look lives here; the parent places it. An end of the sequence has no link.
// kind says what is stepped through, so a screen reader hears "Previous lesson" for the link it holds.
export function PageNav({ kind, previous, next, placement = "" }: { kind: "lesson" | "course"; previous: Step; next: Step; placement?: string }) {
  if (!previous && !next) return null
  return (
    <nav aria-label={`Previous and next ${kind}`} className={`grid gap-3 sm:grid-cols-2 ${placement}`.trim()}>
      <div className="min-w-0 flex">
        {previous && (
          <ActionLink variant="outlined" href={previous.href} wrap placement="w-full justify-start">
            {`← Previous ${kind}: ${previous.title}`}
          </ActionLink>
        )}
      </div>
      <div className="min-w-0 flex">
        {next && (
          <ActionLink variant="outlined" href={next.href} wrap arrow placement="w-full justify-end">
            {`Next ${kind}: ${next.title}`}
          </ActionLink>
        )}
      </div>
    </nav>
  )
}
