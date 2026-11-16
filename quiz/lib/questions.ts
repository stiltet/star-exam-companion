import type { Question } from "./exam-data.ts"
import type { RoundItem } from "./learn.ts"
import { applyNames, type Glossary } from "./sources.ts"

// The written questions and the map from a study section id to its exam-guide section number,
// both from the exam (study.json, pack.json).
export type Bank = { questions: Question[]; sectionOf: Record<string, string> }

// The written questions, once each: the upstream list repeats q59–q80, and the first copy of each
// id is kept. A Study topic counts these, so its number matches what Practice asks.
export function writtenQuestions(questions: Question[]): Question[] {
  return questions.filter((question, index) => questions.findIndex((other) => other.id === question.id) === index)
}

// The written questions as id and exam section: all a device needs to count them, without their text.
export function writtenPool(bank: Bank): { id: string; section: number }[] {
  return writtenQuestions(bank.questions).map((question) => ({ id: question.id, section: Number(bank.sectionOf[question.sectionId] ?? 0) }))
}

// Every question Practice asks, as id and exam section, for counting progress on the device.
export function practiceItems(items: Pick<RoundItem, "id" | "section">[], written: { id: string; section: number }[]): { id: string; section: number }[] {
  return [...items.map((item) => ({ id: item.id, section: item.section })), ...written]
}

// Practice and Exam ask the voice scenes and the written questions. Written questions keep
// their own wording and explanations; an old product name gets the current one beside it.
export function quizQuestions(glossary: Glossary, items: RoundItem[], bank: Bank): Question[] {
  const scenes: Question[] = items.map((item) => ({
    id: item.id,
    sectionId: String(item.section),
    topicId: item.guideId,
    // The binding constraint is part of the question, as in the Voice quiz, so the answer can be worked out from it.
    question: `${item.stem} ${item.constraint}`,
    options: item.options,
    correctIndex: item.correctIndex,
    // The plan the owner approved: the explanation keeps the constraint and adds the correct term's meaning.
    explanation: `${item.constraint} ${item.options[item.correctIndex] ?? ""}: ${item.why}`,
    // One reason per wrong option, never the correct one. A copy saved before the reasons were stored falls back to one plain line each.
    whyOthersWrong: item.wrong ?? item.options.filter((_, index) => index !== item.correctIndex).map(() => "It does not meet the constraint."),
    officialDoc: item.source,
    difficulty: "medium" as const,
  }))
  const names = (text: string) => applyNames(glossary, text)
  const written: Question[] = writtenQuestions(bank.questions).map((question) => ({
    ...question,
    sectionId: bank.sectionOf[question.sectionId] ?? question.sectionId,
    question: names(question.question),
    options: question.options.map(names),
    explanation: names(question.explanation),
    whyOthersWrong: question.whyOthersWrong.map(names),
  }))
  return [...scenes, ...written]
}
