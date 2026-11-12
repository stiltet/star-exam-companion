import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { Heading } from "@/components/atoms/heading"
import { Text } from "@/components/atoms/text"
import { ActionLink } from "@/components/atoms/button"
import { TextLink } from "@/components/atoms/text-link"

// What the app does, in the order a visitor meets it. The page holds nothing about anyone's studying: figures and plans live on the
// Progress page, on the person's own device.
const FEATURES: { name: string; what: string }[] = [
  { name: "Voice quiz", what: "Answer spoken questions out loud." },
  { name: "Read aloud", what: "Listen to course lessons." },
  { name: "Practice questions", what: "Exam-style questions with explanations." },
  { name: "Practice exam", what: "A timed run of the full exam." },
  { name: "Flashcards", what: "Revise the key terms." },
  { name: "Private and offline", what: "Your answers stay on your device." },
]

export default function AboutPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />

      <main className="flex-1 max-w-4xl mx-auto px-4 py-8 w-full">
        <Heading variant="title" placement="mb-3">About</Heading>
        <Text variant="muted" placement="mb-2">
          A free, open-source study companion for Google Cloud certification exams. Learn by listening, answering and revising, on your phone or your computer.
        </Text>
        <Text variant="note" placement="mb-8">Not an official Google product. Check every answer against Google&apos;s documentation.</Text>

        <section className="mb-8">
          <Heading variant="rule" placement="mb-3">What it does</Heading>
          <ul className="grid gap-x-6 gap-y-3 sm:grid-cols-2 list-none p-0 m-0">
            {FEATURES.map((feature) => (
              <li key={feature.name}>
                <Text variant="strong">{feature.name}</Text>
                <Text variant="muted">{feature.what}</Text>
              </li>
            ))}
          </ul>
        </section>

        <section className="mb-8">
          <Heading variant="rule" placement="mb-3">Author</Heading>
          <Text variant="muted">
            Built and maintained by <TextLink href="https://github.com/stiltet">Stellan Lindell</TextLink>, who uses it to prepare for Google Cloud certifications.
          </Text>
        </section>

        <section className="mb-8">
          <Heading variant="rule" placement="mb-3">Certifications</Heading>
          <div className="flex flex-wrap items-baseline justify-between gap-x-3">
            <Text variant="strong">Generative AI Leader</Text>
            <Text variant="note">Google Cloud · Passed October 2026</Text>
          </div>
        </section>

        <section className="mb-8">
          <Heading variant="rule" placement="mb-3">Open source</Heading>
          <Text variant="muted" placement="mb-3">Released under the MIT licence. Contributions and bug reports are welcome.</Text>
          <div className="flex flex-wrap gap-3 mb-3">
            <ActionLink variant="outlined" href="https://github.com/stiltet/star-exam-companion" newTab>VIEW SOURCE ON GITHUB</ActionLink>
            <ActionLink variant="outlined" href="https://github.com/stiltet/star-exam-companion/issues" newTab>REPORT AN ISSUE</ActionLink>
          </div>
          <Text variant="note">
            Started as a fork of <TextLink href="https://github.com/ludovicobesana/gail-exam-preparation">gail-exam-preparation</TextLink> by Ludovico Besana, MIT licence.
          </Text>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}
