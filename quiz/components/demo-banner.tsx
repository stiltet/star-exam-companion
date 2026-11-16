import { Text } from "@/components/atoms/text"
import { NOTICE_URL, SETUP_URL, STATIC_DEMO } from "@/lib/static-demo"

// A note across the top of every page of the online demo (GitHub Pages). It says what works here
// and where the rest runs. The local app never shows it.
export function DemoBanner() {
  if (!STATIC_DEMO) return null
  return (
    // The same container as the header and footer; the look is the warning atom's, the same yellow as the unfinished notice.
    <div className="max-w-4xl mx-auto px-4 pt-4" data-testid="demo-banner">
      <Text variant="banner" role="note">
        <strong>Online demo.</strong> Study, Practice, Test exam, Flashcards and Glossary work here, and all
        answers stay locally in your browser.{" "}
        <a href={SETUP_URL} target="_blank" rel="noopener noreferrer" className="underline font-bold">
          Clone it and serve it locally
        </a>{" "}
        to use all features. Not affiliated with Google: see{" "}
        <a href={NOTICE_URL} target="_blank" rel="noopener noreferrer" className="underline font-bold">
          the notice
        </a>
        .
      </Text>
    </div>
  )
}
