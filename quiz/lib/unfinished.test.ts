import assert from "node:assert/strict"
import test from "node:test"
import { testPack } from "./test-pack.ts"
import { isMissing } from "./unfinished.ts"

// The shipped Generative AI Leader exam is the finished one; variants of it stand in for an unfinished exam.
const finished = { study: testPack.study, scenes: testPack.scenes, glossaryText: testPack.glossaryText }
const empty = { study: { sections: [], questions: [] }, scenes: [], glossaryText: testPack.glossaryText }

test("a finished exam is missing nothing", () => {
  for (const need of ["questions", "study", "glossary", "scenes"] as const) assert.equal(isMissing(need, finished), false, need)
})

test("an exam with no written questions and no scenes is missing questions, scenes and study", () => {
  for (const need of ["questions", "study", "scenes"] as const) assert.equal(isMissing(need, empty), true, need)
})

test("scenes with no written questions are enough for Practice and the practice exam, so questions are not missing", () => {
  const scenesOnly = { ...finished, study: { ...finished.study, questions: [] } }
  assert.equal(isMissing("questions", scenesOnly), false)
  assert.equal(isMissing("scenes", scenesOnly), false)
})

test("written questions with no scenes are enough for the questions, and the voice quiz is still missing its scenes", () => {
  const questionsOnly = { ...finished, scenes: [] }
  assert.equal(isMissing("questions", questionsOnly), false)
  assert.equal(isMissing("scenes", questionsOnly), true)
})

test("scenes whose terms the glossary lacks do not count, as the lists drop them, so questions are missing", () => {
  const orphans = { study: { sections: finished.study.sections, questions: [] }, scenes: finished.scenes, glossaryText: "# A glossary with no rows\n" }
  assert.equal(isMissing("questions", orphans), true)
  assert.equal(isMissing("scenes", orphans), true)
})
