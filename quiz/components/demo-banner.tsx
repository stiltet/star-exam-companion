import { Text } from "@/components/atoms/text"
import { SETUP_URL, STATIC_DEMO } from "@/lib/static-demo"

// A note across the top of every page of the online demo (GitHub Pages). It says what works here
// and where the rest runs. The local app never shows it.
export function DemoBanner() {
  if (!STATIC_DEMO) return null
  return (
    // The same container as the header and footer; the look is the warning atom's, the same yellow as the unfinished notice.
    <div className="max-w-4xl mx-auto px-4 pt-4" data-testid="demo-banner">
      <Text variant="warning" role="note" placement="text-center">
        <strong>Online demo.</strong> Study, Practice, the Test exam, Flashcards and the Glossary work
        here, and your answers stay in this browser. Voice Quiz, Read Aloud and Progress are core features
        that run on your own computer:{" "}
        <a href={SETUP_URL} target="_blank" rel="noopener noreferrer" className="underline font-bold">
          clone it and serve it locally
        </a>{" "}
        to use them.
      </Text>
    </div>
  )
}
