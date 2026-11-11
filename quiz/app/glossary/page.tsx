import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import Link from "next/link"
import { loadPlay } from "@/lib/load"
import { Names } from "@/components/names"
import { sectionLabel } from "@/lib/progress"
import { applyNames, label, plainNames } from "@/lib/sources"
import { connection } from "next/server"
import { STATIC_DEMO } from "@/lib/static-demo"

// A category's anchor: letters and digits with single dashes, so "Section 1 (~13%)" is #section-1-13, not
// a link with spaces and a stray percent sign that a phone may fail to follow.
const anchorId = (category: string): string => category.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "category"

// Rendered per request, so an edit to glossary.md shows without a rebuild. The online demo is
// built once, as plain files, so it does not wait for a request.
export default async function GlossaryPage() {
  if (!STATIC_DEMO) await connection()
  const play = loadPlay()
  const GLOSSARY = play.ok
    ? play.glossary.terms.map((term) => ({
        term: label(play.glossary, term.term),
        definition: applyNames(play.glossary, term.meaning),
        category: term.guides[0] ? sectionLabel(term.guides[0].split(".")[0] ?? "", play.weights[Number(term.guides[0].split(".")[0])] ?? 0) : play.pack.meta.unnumberedLabel,
      }))
    : []
  const grouped = GLOSSARY.reduce(
    (acc, item) => {
      if (!acc[item.category]) {
        acc[item.category] = []
      }
      acc[item.category].push(item)
      return acc
    },
    {} as { [key: string]: typeof GLOSSARY },
  )

  const categories = Object.keys(grouped).sort()

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />

      <main className="flex-1 max-w-4xl mx-auto px-4 py-8 w-full">
        <h1 className="sr-only text-2xl font-bold mb-2">GLOSSARY</h1>
        <p className="text-muted-foreground mb-8">
          All terms for the {play.ok ? play.pack.meta.title : ""} exam, from official Google Cloud documentation. {GLOSSARY.length} entries.
        </p>

        {/* Quick Nav */}
        <div className="border-2 border-foreground p-4 mb-6">
          <h2 className="font-bold mb-2 text-sm">CATEGORIES</h2>
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <a
                key={cat}
                href={`#${anchorId(cat)}`}
                className="text-sm border border-foreground px-2 py-1 hover:bg-muted"
              >
                {cat.toUpperCase()} ({grouped[cat].length})
              </a>
            ))}
          </div>
        </div>

        {/* Terms by Category */}
        {categories.map((category) => (
          <section key={category} id={anchorId(category)} className="mb-8">
            <h2 className="text-lg font-bold border-b-2 border-foreground pb-2 mb-4">{category.toUpperCase()}</h2>
            <div className="border-2 border-foreground divide-y divide-foreground">
              {grouped[category]
                .sort((a, b) => plainNames(a.term).localeCompare(plainNames(b.term)))
                .map((item) => (
                  <div key={item.term} className="p-4">
                    <dt className="font-bold"><Names text={item.term} /></dt>
                    <dd className="text-muted-foreground mt-1"><Names text={item.definition} /></dd>
                  </div>
                ))}
            </div>
          </section>
        ))}

        {/* Practice Link */}
        <div className="border-2 border-foreground p-4 mt-8">
          <p className="mb-2">Ready to test your knowledge?</p>
          <Link
            href="/flashcards"
            className="inline-block border-2 border-foreground px-4 py-2 no-underline hover:bg-foreground hover:text-background"
          >
            PRACTICE WITH FLASHCARDS →
          </Link>
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
