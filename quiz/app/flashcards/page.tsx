import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { FlashcardsClient } from "@/components/flashcards-client"
import { loadPlay } from "@/lib/load"
import { sectionLabel } from "@/lib/progress"
import { applyNames, label } from "@/lib/sources"
import { connection } from "next/server"

// Rendered per request, so an edit to glossary.md shows without a rebuild.
export default async function FlashcardsPage() {
  await connection()
  const play = loadPlay()
  const glossary = play.ok
    ? play.glossary.terms.map((term) => ({
        key: term.term,
        term: label(play.glossary, term.term),
        definition: applyNames(play.glossary, term.meaning),
        category: term.guides[0] ? sectionLabel(term.guides[0].split(".")[0] ?? "", play.weights[Number(term.guides[0].split(".")[0])] ?? 0) : "Study guide",
      }))
    : []
  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />

      <main className="flex-1 max-w-4xl mx-auto px-4 py-8 w-full">
        <FlashcardsClient glossary={glossary} />
      </main>

      <SiteFooter />
    </div>
  )
}
