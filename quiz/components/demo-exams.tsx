import { PageLink } from "@/components/atoms/page-link"
import { Text } from "@/components/atoms/text"
import { DEMO_PACKS } from "@/lib/static-demo"

// The online demo's exam choice. Each exam is its own copy of the demo, so these are plain links. The local
// app switches exam on Progress instead and never shows this.
export function DemoExams() {
  if (DEMO_PACKS.length < 2) return null
  return (
    <nav aria-label="Exam" className="border-t-2 border-foreground">
      <ul className="max-w-4xl mx-auto px-4 py-2 flex flex-wrap items-center gap-x-4 gap-y-1">
        <li>
          <Text variant="label">EXAM</Text>
        </li>
        {DEMO_PACKS.map((pack) => (
          <li key={pack.id}>
            <PageLink href={pack.href} current={pack.current}>
              {pack.title}
            </PageLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
