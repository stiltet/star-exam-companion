import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { Heading } from "@/components/atoms/heading"
import { Text } from "@/components/atoms/text"

// The About page is public: it ships in the static demo. It holds no study plan and no
// progress figures. Those live on the Progress page.
export default function AboutPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />

      <main className="flex-1 max-w-4xl mx-auto px-4 py-8 w-full flex flex-col gap-6">
        <Heading variant="page">About</Heading>

        <section className="flex flex-col gap-2">
          <Heading variant="rule">What it is</Heading>
          <Text variant="muted">
            Star Exam Companion is a free, open-source study companion for Google Cloud certification exams. It is not an
            official Google product, so verify content against Google&apos;s own documentation.
          </Text>
        </section>

        <section className="flex flex-col gap-2">
          <Heading variant="rule">What it does</Heading>
          <Text variant="muted">
            Voice Quiz, Read Aloud, practice questions, a timed practice exam and flashcards. Every answer stays on your own
            device, and everything works offline.
          </Text>
        </section>

        <section className="flex flex-col gap-2">
          <Heading variant="rule">The author</Heading>
          <Text variant="muted">
            Built by{" "}
            <a href="https://github.com/stiltet" target="_blank" rel="noopener noreferrer" className="underline font-bold">Stellan Lindell</a>
            , who uses it to prepare for Google Cloud exams.
          </Text>
        </section>

        <section className="flex flex-col gap-2">
          <Heading variant="rule">Certifications</Heading>
          <Text variant="muted">Generative AI Leader. Passed 22 October 2026, valid until 22 October 2029.</Text>
        </section>

        <section className="flex flex-col gap-2">
          <Heading variant="rule">Open source</Heading>
          <Text variant="muted">
            <a href="https://github.com/stiltet/star-exam-companion" target="_blank" rel="noopener noreferrer" className="underline">Source code</a>
            {" · "}
            <a href="https://github.com/stiltet/star-exam-companion/issues" target="_blank" rel="noopener noreferrer" className="underline">Report an issue</a>
            {" · MIT licence. Started as a fork of "}
            <a href="https://github.com/ludovicobesana/gail-exam-preparation" target="_blank" rel="noopener noreferrer" className="underline">gail-exam-preparation</a>
            {" by Ludovico Besana."}
          </Text>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}
