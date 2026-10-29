import { SETUP_URL, STATIC_DEMO } from "@/lib/static-demo"

// A note across the top of every page of the online demo (GitHub Pages). It says what works here
// and where the rest runs. The local app never shows it.
export function DemoBanner() {
  if (!STATIC_DEMO) return null
  return (
    <div role="note" className="border-b-2 border-foreground bg-muted px-4 py-2 text-center text-sm">
      <strong>Online demo.</strong> Study, Practice, the Practice exam, Flashcards and the Glossary work
      here, and your answers stay in this browser. Voice Quiz, Read Aloud and Progress are core features
      that run on your own computer:{" "}
      <a href={SETUP_URL} target="_blank" rel="noopener noreferrer" className="underline font-bold">
        clone it and serve it locally
      </a>{" "}
      to use them.
    </div>
  )
}
