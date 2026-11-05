import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { activePack } from "@/lib/pack"
import { sectionLabel } from "@/lib/progress"
import Link from "next/link"

export default function StudyPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />

      <main className="flex-1 max-w-4xl mx-auto px-4 py-8 w-full">
        <h1 className="sr-only text-2xl font-bold mb-2">STUDY SECTIONS</h1>
        <p className="text-muted-foreground mb-8">
          Select a section to study. Topics mapped 1:1 to official exam outline.
        </p>

        <div className="space-y-6">
          {activePack().study.sections.map((section, index) => (
            <section key={section.id} className="border-2 border-foreground">
              <div className="p-4 border-b-2 border-foreground bg-foreground text-background">
                <h2 className="font-bold">{sectionLabel(index + 1, section.weight)}</h2>
                <p className="text-sm text-background/70">{section.title}. {section.description}</p>
              </div>
              <div className="divide-y divide-foreground">
                {section.topics.map((topic) => (
                  <Link
                    key={topic.id}
                    href={`/study/${section.id}/${topic.id}`}
                    className="block p-4 no-underline hover:bg-muted"
                  >
                    <div className="flex justify-between items-center">
                      <span>{topic.title}</span>
                      <span className="text-muted-foreground">→</span>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
