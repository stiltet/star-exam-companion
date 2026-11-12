import { Heading } from "@/components/atoms/heading"
import { SETUP_URL } from "@/lib/static-demo"

// What replaces Voice Quiz, Read Aloud and Progress in the online demo: they are core features that
// need the quiz running on the reader's own computer, and this says how to get that. The commands
// are the README's Quick start; scripts/readme.test.mts checks that they still match it.
export function LocalOnlyPanel({ feature, what, voice = false }: { feature: string; what: string; voice?: boolean }) {
  return (
    <section className="border-2 border-foreground p-6">
      <Heading variant="page" placement="mb-4">{feature} runs on your computer</Heading>
      <p className="mb-4">
        {feature} is a core feature of Star Exam Companion. It {what}, so it needs the quiz cloned and served on
        your own computer. This online demo cannot do that.
      </p>
      {voice && <p className="mb-4">The voice is your Mac&apos;s own, so this feature needs a Mac.</p>}
      <p className="mb-2 font-bold">Run it locally:</p>
      <pre tabIndex={0} className="mb-4 overflow-x-auto border-2 border-foreground bg-muted p-4 text-sm">
        {`git clone https://github.com/stiltet/star-exam-companion.git
cd star-exam-companion
pnpm install
pnpm build
pnpm start:local`}
      </pre>
      <p className="mb-4">
        Then open http://localhost:3000/. You need Node.js 22.18 or newer and pnpm 10.6 or newer.
      </p>
      <a href={SETUP_URL} target="_blank" rel="noopener noreferrer" className="underline font-bold">
        Full local setup, with certificates for your phone →
      </a>
    </section>
  )
}
