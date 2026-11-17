import { PageShell } from "@/components/organisms/page-shell"
import { FlashcardsClient } from "@/components/flashcards-client"
import { UnfinishedNotice } from "@/components/unfinished-notice"
import { loadPlay } from "@/lib/load"
import { sectionLabel } from "@/lib/progress"
import { applyNames, label } from "@/lib/sources"
import { connection } from "next/server"
import { STATIC_DEMO } from "@/lib/static-demo"

// Rendered per request, so an edit to glossary.md shows without a rebuild. The online demo is
// built once, as plain files, so it does not wait for a request.
export default async function FlashcardsPage() {
  if (!STATIC_DEMO) await connection()
  const play = loadPlay()
  const glossary = play.ok
    ? play.glossary.terms.map((term) => ({
        key: term.term,
        term: label(play.glossary, term.term),
        definition: applyNames(play.glossary, term.meaning),
        category: term.guides[0] ? sectionLabel(term.guides[0].split(".")[0] ?? "", play.weights[Number(term.guides[0].split(".")[0])] ?? 0) : play.pack.meta.unnumberedLabel,
      }))
    : []
  return (
    <PageShell>
      <UnfinishedNotice need="glossary" />
      <FlashcardsClient glossary={glossary} />
    </PageShell>
  )
}
