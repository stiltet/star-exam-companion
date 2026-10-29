import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { EXAM_SECTIONS } from "@/lib/exam-data"
import { sectionLabel } from "@/lib/progress"
import Link from "next/link"
import { notFound } from "next/navigation"

type Props = {
  params: Promise<{ sectionId: string }>
}

// Every section is known at build time, so the online demo can export its pages.
export function generateStaticParams() {
  return EXAM_SECTIONS.map((section) => ({ sectionId: section.id }))
}

export default async function SectionPage({ params }: Props) {
  const { sectionId } = await params

  const section = EXAM_SECTIONS.find((s) => s.id === sectionId)
  if (!section) notFound()

  const sectionIndex = EXAM_SECTIONS.findIndex((s) => s.id === sectionId)
  const label = sectionLabel(sectionIndex + 1, section.weight)
  const prevSection = sectionIndex > 0 ? EXAM_SECTIONS[sectionIndex - 1] : null
  const nextSection = sectionIndex < EXAM_SECTIONS.length - 1 ? EXAM_SECTIONS[sectionIndex + 1] : null

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />

      <main className="flex-1 max-w-4xl mx-auto px-4 py-8 w-full">
        {/* Breadcrumb */}
        <nav className="text-sm mb-6 text-muted-foreground">
          <Link href="/study">STUDY</Link>
          <span className="mx-2">/</span>
          <span className="text-foreground">{label.toUpperCase()}</span>
        </nav>

        {/* Header */}
        <header className="border-2 border-foreground p-6 mb-6 bg-foreground text-background">
          <h1 className="text-2xl font-bold">{label}</h1>
          <p className="text-background/70 mt-1">{section.title}. {section.description}</p>
        </header>

        {/* Topics */}
        <section className="mb-8">
          <h2 className="text-lg font-bold border-b-2 border-foreground pb-2 mb-4">TOPICS ({section.topics.length})</h2>
          <div className="divide-y-2 divide-foreground border-2 border-foreground">
            {section.topics.map((topic, index) => (
              <Link
                key={topic.id}
                href={`/study/${sectionId}/${topic.id}`}
                className="block p-4 no-underline hover:bg-muted"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-muted-foreground mr-2">{String(index + 1).padStart(2, "0")}.</span>
                    <span className="font-medium">{topic.title}</span>
                  </div>
                  <span className="text-muted-foreground">→</span>
                </div>
                <p className="text-sm text-muted-foreground mt-1 ml-6">{Array.isArray(topic.concepts) ? topic.concepts.length : 0} concepts</p>
              </Link>
            ))}
          </div>
        </section>

        {/* Section Navigation */}
        <nav className="border-t-2 border-foreground pt-6 flex justify-between">
          {prevSection ? (
            <Link href={`/study/${prevSection.id}`} className="text-sm">
              ← {sectionLabel(sectionIndex, prevSection.weight)}
            </Link>
          ) : (
            <span />
          )}
          {nextSection ? (
            <Link href={`/study/${nextSection.id}`} className="text-sm">
              {sectionLabel(sectionIndex + 2, nextSection.weight)} →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      </main>

      <SiteFooter />
    </div>
  )
}
