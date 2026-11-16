import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { practiceItems, quizQuestions, writtenPool } from "./questions.ts"
import { practiceProgress } from "./progress.ts"
import { itemsFromGlossary } from "./round.ts"
import { parseGlossary } from "./sources.ts"
import { testBank, testPack } from "./test-pack.ts"

const parsed = parseGlossary(testPack.glossaryText)
if (!parsed.ok) throw new Error(`glossary row ${parsed.row}: ${parsed.error}`)
const glossary = parsed.glossary
const items = itemsFromGlossary(glossary, testPack.scenes)

test("Practice and Exam ask every voice scene and every written question", () => {
  const ids = quizQuestions(glossary, items, testBank).map((question) => question.id)
  assert.equal(new Set(ids).size, ids.length)
  for (const item of items) assert.ok(ids.includes(item.id), item.id)
  for (const question of testPack.study.questions) assert.ok(ids.includes(question.id), question.id)
})

test("a voice scene in Practice shows its constraint in the question and gives each wrong option, and only those, its own reason", () => {
  const scenes = quizQuestions(glossary, items, testBank).filter((question) => items.some((item) => item.id === question.id))
  assert.ok(scenes.length > 0)
  for (const question of scenes) {
    const item = items.find((entry) => entry.id === question.id)!
    assert.ok(question.question.includes(item.constraint), `${question.id}: the constraint is in the question`)
    assert.equal(question.whyOthersWrong.length, question.options.length - 1, `${question.id}: one reason per wrong option`)
    const wrong = question.options.filter((_, index) => index !== question.correctIndex)
    question.whyOthersWrong.forEach((reason, index) => {
      assert.ok(reason.startsWith(`${wrong[index]}:`), `${question.id}: reason ${index} is for option ${wrong[index]}`)
      assert.notEqual(reason, "It does not meet the constraint.")
    })
    assert.equal(new Set(question.whyOthersWrong).size, question.whyOthersWrong.length, `${question.id}: no reason repeats`)
    assert.ok(question.explanation.startsWith(`${question.options[question.correctIndex]}:`), `${question.id}: the explanation names the right answer`)
  }
})

test("every voice scene's official document is a web address, so its link never opens the quiz's own 404 page", () => {
  const bad = items.filter((item) => !/^https:\/\//.test(item.source)).map((item) => `${item.id}: ${item.source}`)
  assert.deepEqual(bad, [])
})

test("written questions sit in exam sections 1 to 4 and keep their own explanations", () => {
  const written = quizQuestions(glossary, items, testBank).filter((question) => question.id.startsWith("q"))
  assert.deepEqual([...new Set(written.map((question) => question.sectionId))].sort(), ["1", "2", "3", "4"])
  const q44 = written.find((question) => question.id === "q44")
  assert.equal(q44?.sectionId, "2")
  assert.notEqual(q44?.whyOthersWrong[0], "It does not meet the constraint.")
})

test("written questions use the name to learn, any other name only as also called", () => {
  // The owner's rule, 19 Oct: exam-guide name first, then the newest Google name.
  const retired = /Vertex|Agent Builder|Agentspace|Dialogflow|Contact Center AI|CCAI|Conversation Insights|AutoML Tables|PaLM|Gemini 1\.|Gemini Ultra|\bGCP\b|Chirp(?! 3)|(?<!(?:formerly|also called) )(?:NotebookLM|Google AI Pro|Customer Experience Agent Studio|Customer Experience Insights|Gemini Enterprise for Customer Experience|Cloud Run functions|Google Workspace with Gemini)/i
  const deprecatedNote = "Google's Vertex Explainable AI tool is deprecated"
  const written = quizQuestions(glossary, items, testBank).filter((question) => question.id.startsWith("q"))
  for (const question of written) {
    const texts = [question.question, ...question.options, question.explanation, ...question.whyOthersWrong]
    for (const text of texts) assert.equal(retired.test(text.replace(deprecatedNote, "")), false, `${question.id}: ${text}`)
  }
  assert.ok(written.find((question) => question.id === "q44")?.options.includes("Agent Search"))
})

test("practice progress counts every question Practice asks, written ones included, each once", () => {
  const pool = practiceItems(items, writtenPool(testBank))
  assert.equal(pool.length, quizQuestions(glossary, items, testBank).length)
  assert.equal(new Set(pool.map((item) => item.id)).size, pool.length)
  const sections = [1, 2, 3, 4].map((id) => ({ id, title: `S${id}`, weight: 25 }))
  const lines = [{ date: "2026-10-09", session: 1, mode: "practice", asked: ["q44", items[0]?.id ?? ""], missed: ["q44"] }]
  const progress = practiceProgress(pool, lines, sections)
  assert.equal(progress.total, pool.length)
  assert.equal(progress.asked, 2)
  assert.equal(progress.correct, 1)
  assert.equal(progress.sections.reduce((sum, section) => sum + section.total, 0), pool.length)
})
