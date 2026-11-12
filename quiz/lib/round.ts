import { applyNames, label, preferredName, type Glossary, type Term } from "./sources.ts"
import { isLearned, type RoundItem, type ScoreLine } from "./learn.ts"
import type { Scene } from "./pack.ts"

function sectionOf(guideId: string): number {
  return Number(guideId.split(".")[0]) || 0
}

function hash(text: string): number {
  let value = 0
  for (const char of text) value = (value * 33 + char.charCodeAt(0)) >>> 0
  return value
}

function findTerm(glossary: Glossary, name: string): Term | undefined {
  return glossary.terms.find((term) => term.term.toLowerCase() === name.toLowerCase())
}

// The meaning without the rename markers, which name products rather than explain the answer.
export function reasonFrom(meaning: string): string {
  return meaning.replace(/\s*\*\*(?:Renamed|Exam guide):\*\*[^*]*?(?:\.(?=\s|$)|$)/g, "").trim()
}

// A Source cell as text: "[Google page](https://…)" reads as "Google page".
export function sourceText(source: string): string {
  return source.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").trim()
}

function rotate(correct: string, distractors: string[], seed: string): { options: string[]; correctIndex: number } {
  const names = [correct, ...distractors]
  const order = hash(seed) % names.length
  const options = names.map((_, index) => names[(index + order) % names.length] ?? correct)
  return { options, correctIndex: options.indexOf(correct) }
}

// One item per scene whose terms the glossary has. The scenes come from the exam.
export function itemsFromGlossary(glossary: Glossary, scenes: Scene[]): RoundItem[] {
  const items: RoundItem[] = []
  for (const scene of scenes) {
    const correctTerm = findTerm(glossary, scene.correct)
    const distractorTerms = scene.distractors.map((name) => findTerm(glossary, name))
    if (!correctTerm || distractorTerms.some((term) => !term)) continue
    const guideId = scene.guide ?? correctTerm.guides[0] ?? "0"
    const correct = preferredName(glossary, scene.correct)
    const { options, correctIndex } = rotate(correct, scene.distractors.map((name) => preferredName(glossary, name)), scene.id)
    items.push({
      id: scene.id,
      section: sectionOf(guideId),
      course: scene.course,
      guideId,
      stem: scene.scene,
      options: options.map((name) => label(glossary, name)),
      correctIndex,
      constraint: scene.constraint,
      source: correctTerm.sourceUrl || correctTerm.source,
      why: applyNames(glossary, reasonFrom(correctTerm.meaning)),
      whySource: sourceText(correctTerm.source),
    })
  }
  return items
}

// The questions still to get right, in a new order. A question answered right drops out; one
// missed stays until it is right STREAK_TO_LEARN times in a row, in any session.
export function takeRound(items: RoundItem[], lines: ScoreLine[], random: () => number = Math.random): RoundItem[] {
  const copy = items.filter((item) => !isLearned(item.id, lines))
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1))
    const current = copy[index]
    const other = copy[swapIndex]
    if (current === undefined || other === undefined) continue
    copy[index] = other
    copy[swapIndex] = current
  }
  return copy
}
