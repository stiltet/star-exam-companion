import { PRACTICE_QUESTIONS, type Question } from "./exam-data.ts"
import type { RoundItem } from "./learn.ts"
import { applyNames, type Glossary } from "./sources.ts"

// The written questions' and Study pages' section ids, as exam-guide section numbers.
export const SECTION_OF: Record<string, string> = {
  fundamentals: "1",
  "ai-ml-fundamentals": "1",
  "google-cloud-offerings": "2",
  "improve-output": "3",
  "business-strategies": "4",
}

// The written questions, once each: the upstream list repeats q59–q80, and the first copy of each
// id is kept. A Study topic counts these, so its number matches what Practice asks.
export function writtenQuestions(): Question[] {
  return PRACTICE_QUESTIONS.filter((question, index) => PRACTICE_QUESTIONS.findIndex((other) => other.id === question.id) === index)
}

// Every question Practice asks, as id and exam section, for counting progress on the device.
export function practiceItems(items: Pick<RoundItem, "id" | "section">[]): { id: string; section: number }[] {
  return [
    ...items.map((item) => ({ id: item.id, section: item.section })),
    ...writtenQuestions().map((question) => ({ id: question.id, section: Number(SECTION_OF[question.sectionId] ?? 0) })),
  ]
}

// Practice and Exam ask the voice scenes and the written questions. Written questions keep
// their own wording and explanations; an old product name gets the current one beside it.
export function quizQuestions(glossary: Glossary, items: RoundItem[]): Question[] {
  const scenes: Question[] = items.map((item) => ({
    id: item.id,
    sectionId: String(item.section),
    topicId: item.guideId,
    question: item.stem,
    options: item.options,
    correctIndex: item.correctIndex,
    explanation: item.constraint,
    whyOthersWrong: item.options.map(() => "It does not meet the constraint."),
    officialDoc: item.source,
    difficulty: "medium" as const,
  }))
  const names = (text: string) => applyNames(glossary, text)
  const written: Question[] = writtenQuestions().map((question) => ({
    ...question,
    sectionId: SECTION_OF[question.sectionId] ?? question.sectionId,
    question: names(question.question),
    options: question.options.map(names),
    explanation: names(question.explanation),
    whyOthersWrong: question.whyOthersWrong.map(names),
  }))
  return [...scenes, ...written]
}
