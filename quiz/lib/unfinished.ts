import { itemsFromGlossary } from "./round.ts"
import { parseGlossary } from "./sources.ts"

// When an exam has none of the data a feature needs, so its page can say what is missing (components/unfinished-notice.tsx).
// need: questions (Practice, the practice exam), study (Study), glossary (Glossary, Flashcards), scenes (Voice quiz).
export type Need = "questions" | "study" | "glossary" | "scenes"

export type Source = {
  study: { sections: unknown[]; questions: unknown[] }
  scenes: Parameters<typeof itemsFromGlossary>[1]
  glossaryText: string
}

// The voice scenes the lists really use: those whose terms the glossary has, as itemsFromGlossary decides, so the notice and the lists
// cannot disagree. A glossary that does not parse gives none.
function usableScenes(pack: Source): number {
  const parsed = parseGlossary(pack.glossaryText)
  return parsed.ok ? itemsFromGlossary(parsed.glossary, pack.scenes).length : 0
}

// True when the exam has none of what this feature needs. Practice and the practice exam draw on the written questions and the usable
// voice scenes together, so questions are missing only when both are.
export function isMissing(need: Need, pack: Source): boolean {
  if (need === "questions") return pack.study.questions.length === 0 && usableScenes(pack) === 0
  if (need === "study") return pack.study.sections.length === 0
  if (need === "scenes") return usableScenes(pack) === 0
  const parsed = parseGlossary(pack.glossaryText)
  return parsed.ok && parsed.glossary.terms.length === 0
}
