import assert from "node:assert/strict"
import { readdirSync } from "node:fs"
import path from "node:path"
import test from "node:test"
import { loadPack } from "./pack.ts"
import { quizQuestions } from "./questions.ts"
import { findTerm, itemsFromGlossary } from "./round.ts"
import { isWebAddress, parseGlossary, sourceUrl } from "./sources.ts"
import { testRoot } from "./test-pack.ts"

// Every exam this repo ships, so a guarantee about Practice holds for the exam a branch adds, not only the default one.
const exams = readdirSync(path.join(testRoot, "exams"), { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name)

for (const exam of exams) {
  test(`${exam}: every scene reaches Practice with its constraint, one distinct reason per wrong option and a web address as its document`, () => {
    const pack = loadPack(testRoot, exam)
    const parsed = parseGlossary(pack.glossaryText)
    assert.ok(parsed.ok, "the glossary parses")
    if (!parsed.ok) return
    const items = itemsFromGlossary(parsed.glossary, pack.scenes)
    assert.equal(items.length, pack.scenes.length, "no scene is dropped for a missing term")
    const questions = quizQuestions(parsed.glossary, items, { questions: pack.study.questions, sectionOf: pack.meta.sectionOf })
    for (const item of items) {
      const question = questions.find((entry) => entry.id === item.id)!
      assert.ok(question.question.includes(item.constraint), `${item.id}: the constraint is in the question`)
      assert.ok(question.explanation.startsWith(item.constraint), `${item.id}: the explanation keeps the constraint`)
      assert.equal(question.whyOthersWrong.length, question.options.length - 1, `${item.id}: one reason per wrong option`)
      assert.equal(new Set(question.whyOthersWrong).size, question.whyOthersWrong.length, `${item.id}: no reason repeats`)
      for (const reason of question.whyOthersWrong) assert.ok(!/not the answer the scene asks for|does not meet the constraint/.test(reason), `${item.id}: ${reason}`)
      assert.ok(isWebAddress(item.source), `${item.id}: ${item.source} is a web address`)
    }
    for (const scene of pack.scenes) {
      for (const name of [scene.correct, ...scene.distractors]) assert.ok(findTerm(parsed.glossary, name), `${scene.id}: the option ${name} is a glossary term`)
    }
  })
}

test("a study guide page such as SG p.8 links to the study guide, and a bare source is not a web address", () => {
  assert.match(sourceUrl("SG p.8"), /^https:\/\/services\.google\.com\/.*study_guide/)
  assert.match(sourceUrl("SG p.5–6, EG"), /^https:\/\/services\.google\.com\/.*study_guide/)
  assert.equal(isWebAddress("SG p.8"), false)
  assert.equal(isWebAddress(undefined), false)
  assert.equal(isWebAddress("https://docs.cloud.google.com/iam/docs/overview"), true)
})
