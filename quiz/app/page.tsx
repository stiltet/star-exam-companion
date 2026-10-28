import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { ActionLink } from "@/components/atoms/button"
import { Heading } from "@/components/atoms/heading"
import { GoogleCloudLogo } from "@/components/atoms/google-cloud-logo"
import { Text } from "@/components/atoms/text"
import { SITE_PAGES } from "@/lib/pages"
import { sectionLabel } from "@/lib/progress"
import Link from "next/link"

const DOMAINS = [
  { id: "fundamentals", weight: 30 },
  { id: "google-cloud-offerings", weight: 35 },
  { id: "improve-output", weight: 20 },
  { id: "business-strategies", weight: 15 },
]

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />

      <main className="flex-1 max-w-4xl mx-auto px-4 py-8 w-full">
        {/* Hero */}
        <section className="border-2 border-foreground p-6 mb-8">
          <h1 className="sr-only text-2xl font-bold mb-4">STAR EXAM COMPANION</h1>
          <Heading variant="hero" placement="mb-4">
            <GoogleCloudLogo placement="mb-3 md:mb-0" />
            <span className="block">GENERATIVE AI LEADER</span>
          </Heading>
          {/* The tagline sits over the buttons, and from lg up right of them in the space they leave (owner, 28 Oct). */}
          <div className="flex flex-col lg:flex-row lg:items-start lg:gap-8">
            <Text variant="tagline" placement="mb-4 lg:mb-0 lg:order-last lg:flex-1 lg:min-w-0">
              <span className="lg:hidden">Brutalist. Minimal. Exam-Focused. Voice Assisted. Tracked Progress.</span>
              <span className="hidden lg:flex lg:flex-col lg:whitespace-nowrap">
                <span>Brutalist</span><span>Minimal</span><span>Exam-Focused</span><span>Voice-Assisted</span><span>Tracked Progress</span><span>Open-Source</span>
              </span>
            </Text>
            {/* Voice Quiz starts the second row (owner, 20 Oct), Learning Path the third; each row still wraps on a phone. */}
            <div className="flex flex-col gap-4 lg:shrink-0">
              <div className="flex flex-wrap gap-4">
                <ActionLink variant="filled" href="/study" arrow>START STUDYING</ActionLink>
                <ActionLink variant="outlined" href="/exam" arrow>PRACTICE EXAM</ActionLink>
              </div>
              <div className="flex flex-wrap gap-4">
                <ActionLink variant="outlined" href="/voice" arrow>VOICE QUIZ</ActionLink>
                <ActionLink variant="outlined" href="/read" arrow wrap>OFFICIAL LEARNING READ ALOUD</ActionLink>
              </div>
              <div className="flex flex-wrap gap-4">
                <ActionLink variant="filled" href="https://www.skills.google/paths/1951" newTab>OFFICIAL LEARNING PATH</ActionLink>
              </div>
            </div>
          </div>
        </section>

        {/* Exam Structure */}
        <section className="mb-8">
          <h2 className="text-xl font-bold border-b-2 border-foreground pb-2 mb-4">EXAM STRUCTURE</h2>
          <div className="border-2 border-foreground">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-foreground">
                  <th className="text-left p-3">SECTION</th>
                </tr>
              </thead>
              <tbody>
                {DOMAINS.map((section, index) => (
                  <tr key={section.id} className={index < DOMAINS.length - 1 ? "border-b border-foreground" : ""}>
                    <td className="p-3">
                      <Link href={`/study/${section.id}`} className="font-medium">
                        {sectionLabel(index + 1, section.weight)}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Quick Access */}
        <section className="mb-8">
          <h2 className="text-xl font-bold border-b-2 border-foreground pb-2 mb-4">NAVIGATION</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {SITE_PAGES.map((page) => (
              <Link
                key={page.href}
                href={page.href}
                className="border-2 border-foreground p-4 no-underline hover:bg-foreground hover:text-background group"
              >
                <h3 className="font-bold">{page.href.toUpperCase()}</h3>
                <p className="text-sm text-muted-foreground group-hover:text-background/70">
                  {page.blurb}
                </p>
              </Link>
            ))}
          </div>
        </section>

        {/* Philosophy */}
        <section className="border-2 border-foreground p-6">
          <h2 className="text-xl font-bold mb-4">PHILOSOPHY</h2>
          <ul className="space-y-2 text-sm">
            <li>→ Exam-focused: every element serves exam preparation</li>
            <li>→ Source-grounded: study topics link to official Google docs; Voice Quiz terms come from a glossary checked against Google&apos;s exam guide</li>
            <li>→ Trap-aware: common traps are called out where a topic has them</li>
            <li>→ Spoken practice: Voice Quiz reads exam-style scenes aloud, so you can study hands-free</li>
            <li>→ Offline: the app opens every page and plays the built in voice with no connection to server; answers wait on the phone and reach the server on the next time phone is connected</li>
            <li>→ Open-source: built on gail-exam-preparation; fork, correct, contribute</li>
            <li>→ No fluff: no gamification, no illustrations, no decorations</li>
          </ul>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}
