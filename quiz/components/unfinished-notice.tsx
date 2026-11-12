import { Text } from "@/components/atoms/text"
import { activePack } from "@/lib/pack"
import { parseGlossary } from "@/lib/sources"

// On a feature page of an unfinished exam, the exam's own notice (homeNotice in pack.json) when that feature's data is not written yet,
// so the page says what is missing instead of showing an empty list or a button that starts nothing. A finished exam, or one with
// the data, shows nothing. need: questions (Practice, the practice exam), study (Study), glossary (Glossary, Flashcards), scenes (Voice quiz).
export type Need = "questions" | "study" | "glossary" | "scenes"

function missing(need: Need): boolean {
  const pack = activePack()
  // Practice and the practice exam draw on the written questions and the voice scenes together, so questions are missing only when both are.
  if (need === "questions") return pack.study.questions.length === 0 && pack.scenes.length === 0
  if (need === "study") return pack.study.sections.length === 0
  if (need === "scenes") return pack.scenes.length === 0
  const parsed = parseGlossary(pack.glossaryText)
  return parsed.ok && parsed.glossary.terms.length === 0
}

export function UnfinishedNotice({ need, placement = "mb-6" }: { need: Need; placement?: string }) {
  const { homeNotice } = activePack().meta
  if (!homeNotice || !missing(need)) return null
  return <Text variant="warning" role="status" placement={placement} testId="unfinished-notice">{homeNotice}</Text>
}
