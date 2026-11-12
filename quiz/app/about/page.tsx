import { activePack } from "@/lib/pack"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { AboutProgress } from "@/components/about-progress"

export default function AboutPage() {
  const pack = activePack()
  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />

      <main className="flex-1 max-w-4xl mx-auto px-4 py-8 w-full">
        <h1 className="sr-only text-2xl font-bold mb-6">ABOUT</h1>
        <p className="mb-6">
          Star Exam Companion is a study companion for Google Cloud certification exams, built and used by{" "}
          <a href="https://github.com/stiltet" target="_blank" rel="noopener noreferrer" className="underline font-bold">Stellan Lindell</a>{" "}
          to prepare for them.
        </p>

        <section className="border-2 border-foreground p-6 mb-6 bg-muted">
          <h2 className="font-bold mb-4">MY CERTIFICATIONS</h2>
          <ul className="space-y-3">
            <li>
              <strong>✓ Generative AI Leader</strong>
              <span className="block text-sm text-muted-foreground">Passed 22 October 2026. Valid until 22 October 2029.</span>
            </li>
            <li>
              <strong>Professional Agentic Architect</strong>
              <span className="block text-sm text-muted-foreground">In preparation, with the exam planned for December 2026.</span>
            </li>
          </ul>
        </section>

        <section className="border-2 border-foreground p-6 mb-6">
          <h2 className="font-bold mb-2">MY EXAM PREPARATION</h2>
          <p className="text-muted-foreground text-sm mb-4">
            Studying now: {pack.meta.title}. These figures are read from the answers on this device and the Mac; they are never part of the project.
          </p>
          <AboutProgress />
        </section>

        <section className="border-2 border-foreground p-6 mb-6">
          <h2 className="font-bold mb-4">WHAT IS THIS?</h2>
          <p className="mb-4">
            An open-source study platform for the {pack.meta.certification} certification exam, and for the other exams it carries.
            Brutalist design: minimal, functional, distraction-free. Voice Quiz, Read Aloud, practice questions, a timed practice exam and flashcards, with every answer kept on your own machine and everything working offline.
          </p>
          <p className="text-muted-foreground text-sm">
            NOT an official Google product. Verify content with official documentation.
          </p>
        </section>

        <section className="border-2 border-foreground p-6 mb-6">
          <h2 className="font-bold mb-4">CONTRIBUTE</h2>
          <ul className="space-y-2 text-sm">
            <li>
              → <a href="https://github.com/stiltet/star-exam-companion" target="_blank" rel="noopener noreferrer" className="underline font-bold">⭐ Star the project on GitHub</a>
            </li>
            <li>
              → <a href="https://github.com/stiltet/star-exam-companion/issues" target="_blank" rel="noopener noreferrer" className="underline">Report an issue</a>
            </li>
            <li>
              → <a href="https://github.com/stiltet/star-exam-companion" target="_blank" rel="noopener noreferrer" className="underline">Source code on GitHub</a>
            </li>
          </ul>
        </section>

        <p className="text-muted-foreground text-sm">
          Started as a fork of{" "}
          <a href="https://github.com/ludovicobesana/gail-exam-preparation" target="_blank" rel="noopener noreferrer" className="underline">gail-exam-preparation</a>{" "}
          by Ludovico Besana, under the MIT licence.
        </p>
      </main>

      <SiteFooter />
    </div>
  )
}
