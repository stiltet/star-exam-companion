import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { PRACTICE_QUESTIONS } from "./exam-data.ts"
import { practiceItems, quizQuestions } from "./questions.ts"
import { practiceProgress } from "./progress.ts"
import { itemsFromGlossary } from "./round.ts"
import { parseGlossary } from "./sources.ts"

const parsed = parseGlossary(readFileSync(new URL("../../glossary.md", import.meta.url), "utf8"))
if (!parsed.ok) throw new Error(`glossary row ${parsed.row}: ${parsed.error}`)
const glossary = parsed.glossary
const items = itemsFromGlossary(glossary)

test("Practice and Exam ask every voice scene and every written question", () => {
  const ids = quizQuestions(glossary, items).map((question) => question.id)
  assert.equal(new Set(ids).size, ids.length)
  for (const item of items) assert.ok(ids.includes(item.id), item.id)
  for (const question of PRACTICE_QUESTIONS) assert.ok(ids.includes(question.id), question.id)
})

test("written questions sit in exam sections 1 to 4 and keep their own explanations", () => {
  const written = quizQuestions(glossary, items).filter((question) => question.id.startsWith("q"))
  assert.deepEqual([...new Set(written.map((question) => question.sectionId))].sort(), ["1", "2", "3", "4"])
  const q44 = written.find((question) => question.id === "q44")
  assert.equal(q44?.sectionId, "2")
  assert.notEqual(q44?.whyOthersWrong[0], "It does not meet the constraint.")
})

test("written questions use the name to learn, any other name only as also called", () => {
  // The owner's rule, 19 Oct: exam-guide name first, then the newest Google name.
  const retired = /Vertex|Agent Builder|Agentspace|Dialogflow|Contact Center AI|CCAI|Conversation Insights|AutoML Tables|PaLM|Gemini 1\.|Gemini Ultra|\bGCP\b|Chirp(?! 3)|(?<!(?:formerly|also called) )(?:NotebookLM|Google AI Pro|Customer Experience Agent Studio|Customer Experience Insights|Gemini Enterprise for Customer Experience|Cloud Run functions|Google Workspace with Gemini)/i
  const deprecatedNote = "Google's Vertex Explainable AI tool is deprecated"
  const written = quizQuestions(glossary, items).filter((question) => question.id.startsWith("q"))
  for (const question of written) {
    const texts = [question.question, ...question.options, question.explanation, ...question.whyOthersWrong]
    for (const text of texts) assert.equal(retired.test(text.replace(deprecatedNote, "")), false, `${question.id}: ${text}`)
  }
  assert.ok(written.find((question) => question.id === "q44")?.options.includes("Agent Search"))
})

test("practice progress counts every question Practice asks, written ones included, each once", () => {
  const pool = practiceItems(items)
  assert.equal(pool.length, quizQuestions(glossary, items).length)
  assert.equal(new Set(pool.map((item) => item.id)).size, pool.length)
  const sections = [1, 2, 3, 4].map((id) => ({ id, title: `S${id}`, weight: 25 }))
  const lines = [{ date: "2026-10-09", session: 1, mode: "practice", asked: ["q44", items[0]?.id ?? ""], missed: ["q44"] }]
  const progress = practiceProgress(pool, lines, sections)
  assert.equal(progress.total, pool.length)
  assert.equal(progress.asked, 2)
  assert.equal(progress.correct, 1)
  assert.equal(progress.sections.reduce((sum, section) => sum + section.total, 0), pool.length)
})
