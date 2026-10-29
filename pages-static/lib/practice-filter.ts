// The type import below resolves only in the build copy, where scripts/build-pages.sh puts this file
// next to quiz/lib/exam-data.ts. It is type-only, so the tests here run without it.
import type { Question } from "./exam-data.ts"

// What the Practice page's address asks for: one topic, or one section, or everything, and the
// Unanswered switch on top of any of them.
export type PracticeQuery = { topic?: string; section?: string; unanswered?: string }

// The questions that match, and the key the page remounts on when the filter changes. A topic wins
// over a section, as the page has always done.
export function practiceFilter(questions: Question[], query: PracticeQuery, unansweredAllowed = true) {
  const { topic, section } = query
  const onlyUnanswered = unansweredAllowed && query.unanswered === "1"
  let filtered = questions
  if (topic) filtered = questions.filter((q) => q.topicId === topic)
  else if (section) filtered = questions.filter((q) => q.sectionId === section)
  const key = (topic ? `topic=${topic}` : section ? `section=${section}` : "all") + (onlyUnanswered ? "&unanswered=1" : "")
  return { filtered, key, onlyUnanswered }
}

// A filter link keeps the Unanswered switch as it is; the switch keeps the section or topic.
export function practiceLink(params: Record<string, string>, unansweredOn: boolean): string {
  const query = new URLSearchParams({ ...params, ...(unansweredOn ? { unanswered: "1" } : {}) }).toString()
  return query ? `/practice?${query}` : "/practice"
}
