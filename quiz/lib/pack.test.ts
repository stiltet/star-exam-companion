import assert from "node:assert/strict"
import { readdirSync } from "node:fs"
import path from "node:path"
import test from "node:test"
import { parseSections } from "./learn.ts"
import { loadPack, packDir } from "./pack.ts"
import { itemsFromGlossary } from "./round.ts"
import { parseGlossary } from "./sources.ts"
import { testRoot } from "./test-pack.ts"

// The pack validator: every folder under exams/ must meet the same rules, so a pack added by
// anyone is checked the moment it lands. docs/exam-packs.md lists them.
const ids = readdirSync(path.join(testRoot, "exams"), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)

test("there is at least one exam pack", () => {
  assert.ok(ids.length > 0)
})

for (const id of ids) {
  test(`exam pack ${id} meets the pack rules`, () => {
    const pack = loadPack(testRoot, id)
    assert.equal(pack.meta.id, id)

    const parsed = parseGlossary(pack.glossaryText)
    assert.equal(parsed.ok, true, `${id}/glossary.md does not parse`)
    if (!parsed.ok) return
    const glossary = parsed.glossary
    assert.ok(glossary.terms.length > 0, "the glossary has no rows")
    for (const term of glossary.terms) assert.ok(term.source.trim() !== "", `${id}/glossary.md: "${term.term}" names no source`)

    const sections = parseSections(pack.sectionsText)
    assert.ok(sections.length > 0, `${id}/sections.md: no "Section N (title, ~X%)" lines`)
    assert.equal(sections.reduce((total, section) => total + section.weight, 0), 100, `${id}/sections.md: weights must add up to 100`)
    assert.equal(new Set(sections.map((section) => section.id)).size, sections.length, `${id}/sections.md: a section number repeats`)

    // Scenes: unique ids, three distractors, each term in the glossary, no scene names its answer.
    const ids = pack.scenes.map((scene) => scene.id)
    assert.equal(new Set(ids).size, ids.length, `${id}/scenes.json: a scene id repeats`)
    for (const scene of pack.scenes) {
      assert.equal(scene.distractors.length, 3, `${scene.id}: needs three distractors`)
      assert.ok(scene.scene.trim() && scene.constraint.trim(), `${scene.id}: needs a scene and a constraint`)
      const name = new RegExp(`\\b${scene.correct.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i")
      assert.equal(name.test(scene.scene) || name.test(scene.constraint), false, `${scene.id}: the scene names its own answer`)
    }
    const items = itemsFromGlossary(glossary, pack.scenes)
    assert.equal(items.length, pack.scenes.length, `${id}/scenes.json: a scene names a term the glossary does not have`)
    for (const item of items) assert.ok(sections.some((section) => section.id === item.section), `${item.id}: its guide section is not in sections.md`)

    // Every term the exam guide names, and every glossary row, is the answer to a scene.
    const answers = new Set(pack.scenes.map((scene) => scene.correct.toLowerCase()))
    const skipped = pack.meta.notAsked ?? []
    const asked = (name: string) => {
      if (answers.has(name.toLowerCase())) return true
      const pair = glossary.renames.find((item) => [item.oldName, item.newName].some((other) => other.toLowerCase() === name.toLowerCase()))
      return pair !== undefined && (answers.has(pair.oldName.toLowerCase()) || answers.has(pair.newName.toLowerCase()))
    }
    assert.deepEqual(glossary.terms.map((term) => term.term).filter((name) => !skipped.includes(name) && !asked(name)), [], "a glossary row no scene asks")
    assert.deepEqual(pack.terms.filter((name) => !skipped.includes(name) && !asked(name)), [], "a term in terms.txt no scene asks")

    // Study data: sections map to exam sections, questions are well formed.
    for (const section of pack.study.sections) assert.ok(pack.meta.sectionOf[section.id], `study.json: section "${section.id}" is not in pack.json sectionOf`)
    for (const target of Object.values(pack.meta.sectionOf)) assert.ok(sections.some((section) => String(section.id) === target), `pack.json sectionOf: "${target}" is not a section in sections.md`)
    for (const question of pack.study.questions) {
      assert.ok(pack.meta.sectionOf[question.sectionId], `${question.id}: section "${question.sectionId}" is not in pack.json sectionOf`)
      assert.ok(Number.isInteger(question.correctIndex) && question.correctIndex >= 0 && question.correctIndex < question.options.length, `${question.id}: correctIndex is outside the options`)
    }
    for (const section of pack.study.sections) for (const topic of section.topics) for (const entry of topic.studyQA ?? []) assert.ok(entry.officialSource, `${topic.id}: a study answer names no official source`)
  })
}

test("a pack name that is not a plain slug is refused, so QUIZ_EXAM cannot reach another folder", () => {
  for (const bad of ["../quiz", "a/b", "Upper", "", "a..b", "-x"]) assert.throws(() => packDir(testRoot, bad), /not a pack name/, bad)
})

test("a missing pack says which file it lacks", () => {
  assert.throws(() => loadPack(testRoot, "no-such-exam"), /no pack\.json/)
})
