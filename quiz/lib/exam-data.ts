// The shapes of a pack's study.json. The content lives in exams/<id>/study.json (see pack.ts).

export type StudyQA = { question: string; answer: string; officialSource: string }

export type StudyTopic = {
  id: string
  title: string
  studyQA?: StudyQA[]
  concepts?: string[]
  examFocus?: string
  traps?: string[]
  officialDocs?: { title: string; url: string }[]
}

export type StudySection = {
  id: string
  title: string
  weight: number
  description: string
  topics: StudyTopic[]
}

export type Question = {
  id: string
  sectionId: string
  topicId: string
  question: string
  options: string[]
  correctIndex: number
  explanation: string
  whyOthersWrong: string[]
  officialDoc?: string
  difficulty: "easy" | "medium" | "hard"
}
