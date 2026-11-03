import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { isLearned, parseWeights, sectionCleared, voiceProgress, type ScoreLine } from "./learn.ts"
import { acceptBatch, answerAloud, discussText, localVoices, PAUSE_BEFORE_OPTIONS_MS, PAUSE_BETWEEN_OPTIONS_MS, questionClips } from "./score.ts"
import { preferredName, applyNames, displayTerm, label, parseGlossary, plainNames } from "./sources.ts"
import { itemsFromGlossary, takeRound } from "./round.ts"
import { testBank, testPack } from "./test-pack.ts"


const glossaryText = `
| Term | Meaning | Guide | Source |
| Customer Engagement Suite | Tools to engage customers. **Renamed:** Customer Engagement Suite => Gemini Enterprise for Customer Experience. | 2.3 | EG |
| Gemini Enterprise for Customer Experience | Current name. **Renamed:** Customer Engagement Suite => Gemini Enterprise for Customer Experience. | 2.3 | SG p.5 |
| Fine-tuning | A second training pass. Changes the model. | 3.1 | SG p.9 |
| Grounding | Connecting output to verifiable sources. | 3.1 | SG p.8 |
| Prompt | The instruction you give a model. | 1.1 | SG p.3 |
Names last checked: 2026-09-30
`

test("renders both product names from the glossary", () => {
  const parsed = parseGlossary(glossaryText)
  assert.equal(parsed.ok, true)
  if (!parsed.ok) return
  const shown = displayTerm(parsed.glossary, "Customer Engagement Suite")
  assert.equal(shown.primary, "Customer Engagement Suite")
  assert.equal(shown.also, "Gemini Enterprise for Customer Experience")
})

test("fails closed on an unreadable glossary row", () => {
  const parsed = parseGlossary("| Broken | Says **Renamed:** but not a pair. | 2.3 | EG |")
  assert.equal(parsed.ok, false)
  if (parsed.ok) return
  assert.equal(parsed.row, "Broken")
})

test("retires a missed question after three right answers in a row", () => {
  const items = [{ id: "a", section: 3, guideId: "3.1", stem: "", options: [], correctIndex: 0, constraint: "", source: "", why: "", whySource: "" }]
  const line = (missed: boolean): ScoreLine => ({ date: "2026-10-06", session: 1, mode: "round", asked: ["a"], missed: missed ? ["a"] : [] })
  assert.equal(isLearned("a", [line(false)]), true)
  assert.equal(isLearned("a", [line(true), line(false), line(false)]), false)
  assert.equal(sectionCleared(3, items, [line(true), line(false), line(false)]), false)
  assert.equal(isLearned("a", [line(true), line(false), line(false), line(false)]), true)
  assert.equal(sectionCleared(3, items, [line(true), line(false), line(false), line(false)]), true)
  assert.equal(isLearned("a", [line(true), line(false), line(false), line(true), line(false), line(false)]), false)
})

test("refuses a cross-site or malformed score", () => {
  const answer = { id: "00000000-0000-4000-8000-000000000001", at: "2026-09-30T10:00:00.000Z", mode: "round", asked: ["a"], missed: [] }
  const base = { allowedOrigin: "http://127.0.0.1:3000", bankIds: new Set(["a"]), termNames: new Set<string>(), examLength: { questions: 60, minutes: 90 }, courseIds: ["1", "2", "3", "4", "5"], now: Date.parse("2026-09-30T12:00:00.000Z") }
  assert.equal(acceptBatch({ ...base, origin: "https://evil.example", contentType: "application/json", body: { answers: [answer] } }).ok, false)
  assert.equal(acceptBatch({ ...base, origin: base.allowedOrigin, contentType: "text/plain", body: { answers: [answer] } }).ok, false)
  const malformed = acceptBatch({ ...base, origin: base.allowedOrigin, contentType: "application/json", body: { answers: [{ ...answer, asked: ["nope"], note: "x" }] } })
  assert.deepEqual(malformed, { ok: true, answers: [], rejected: [answer.id], gone: [], reasons: { [answer.id]: "The saved answer has unexpected fields." } })
})

test("reads aloud with local voices only", () => {
  const voices = localVoices([
    { localService: false, lang: "en-GB", name: "online" },
    { localService: true, lang: "en-US", name: "us" },
    { localService: true, lang: "en-GB", name: "uk" },
  ])
  assert.deepEqual(voices.map((voice) => voice.name), ["uk", "us"])
  assert.deepEqual(localVoices([{ localService: false, lang: "en-GB" }]), [])
})

test("discuss text carries the question and both answers", () => {
  const text = discussText({ stem: "Choose.", options: ["One", "Two"], yours: "Two", right: "One", constraint: "Facts are wrong." })
  for (const part of ["Choose.", "A. One", "B. Two", "Your answer: Two", "Right answer: One"]) {
    assert.equal(text.includes(part), true)
  }
  assert.equal(text.includes("Constraint:"), false)
})

test("a question's clips are one for the situation and two per option, and the last name pauses for nothing", () => {
  const three = questionClips("A scene.", ["One", "Two", "Three"])
  assert.equal(three.length, 7)
  assert.deepEqual(three.map((clip) => [clip.part, clip.offset]), [[0, 0], [1, 0], [1, 1], [2, 0], [2, 1], [3, 0], [3, 1]])
  assert.equal(three[6]?.pauseAfter, 0)
  const one = questionClips("A scene.", ["Only"])
  assert.deepEqual(one.map((clip) => clip.text), ["A scene.", "A.", "Only"])
  assert.equal(one[2]?.pauseAfter, 0)
})

test("reads the letters on screen and does not repeat the constraint after an answer", () => {
  const clips = questionClips("A scene.\n\nGrounding, or Fine-tuning?", ["Grounding", "Fine-tuning"])
  assert.deepEqual(clips.map((clip) => clip.text), ["A scene.", "A.", "Grounding", "B.", "Fine-tuning"])
  assert.deepEqual(clips.map((clip) => [clip.part, clip.offset]), [[0, 0], [1, 0], [1, 1], [2, 0], [2, 1]])
  assert.equal(PAUSE_BEFORE_OPTIONS_MS, PAUSE_BETWEEN_OPTIONS_MS * 2)
  assert.equal(clips[0]?.pauseAfter, PAUSE_BEFORE_OPTIONS_MS)
  assert.equal(clips[2]?.pauseAfter, PAUSE_BETWEEN_OPTIONS_MS)
  assert.equal(clips[4]?.pauseAfter, 0)
  assert.equal(answerAloud(true), "Correct.")
  assert.equal(answerAloud(true, "Grounding"), "Correct. Grounding.")
  assert.equal(answerAloud(false), "Incorrect.")
  assert.equal(answerAloud(false, "Grounding"), "Incorrect. The answer is Grounding.")
})

test("voice quiz items are exam format and list the choices only once", () => {
  const parsed = parseGlossary(glossaryText)
  assert.equal(parsed.ok, true)
  if (!parsed.ok) return
  for (const item of itemsFromGlossary(parsed.glossary, testPack.scenes)) {
    assert.equal(item.stem.includes("The binding constraint:"), false)
    assert.equal(item.stem.includes(`, or ${item.options.at(-1)}?`), false, item.id)
    assert.equal(item.options.length >= 2, true)
    assert.equal(item.stem.includes("Vertex AI"), false)
  }
})

test("voice progress keeps the latest answer for each question", () => {
  const items = [
    { id: "a", section: 2, guideId: "2.1", stem: "", options: [], correctIndex: 0, constraint: "", source: "", why: "", whySource: "" },
    { id: "b", section: 2, guideId: "2.1", stem: "", options: [], correctIndex: 0, constraint: "", source: "", why: "", whySource: "" },
  ]
  const lines: ScoreLine[] = [
    { date: "2026-09-30", session: 1, mode: "round", asked: ["a"], missed: ["a"] },
    { date: "2026-09-30", session: 2, mode: "round", asked: ["a"], missed: [] },
  ]
  const progress = voiceProgress(items, lines, [{ id: 2, title: "offerings", weight: 35 }])
  assert.equal(progress.asked, 1)
  assert.equal(progress.correct, 1)
  assert.equal(progress.sections[0]?.asked, 1)
  assert.equal(progress.sections[0]?.total, 2)
})

test("voice quiz asks one written decision per scene, each with its own scene, in all four sections", () => {
  const glossaryFile = testPack.glossaryText
  const parsed = parseGlossary(glossaryFile)
  assert.equal(parsed.ok, true)
  if (!parsed.ok) return
  const items = itemsFromGlossary(parsed.glossary, testPack.scenes)
  // A scene must stand alone: no opening that leans on the question before it (owner, 19 Oct).
  const banned = /same part of the exam|decision this week|The requirement is:|Exam-guide name|^(?:The same|The chosen|Yesterday's)\b/
  const scenes = new Set(items.map((item) => item.stem))
  assert.equal(items.length, testPack.scenes.length, "a scene names a term the glossary does not have")
  assert.deepEqual([...new Set(items.map((item) => item.section))].sort(), [1, 2, 3, 4])
  assert.equal(new Set(items.map((item) => item.id)).size, items.length)
  assert.equal(scenes.size, items.length)
  for (const item of items) {
    assert.equal(banned.test(item.stem), false, item.id)
    assert.equal(item.stem.includes("The binding constraint:"), false)
    assert.equal(item.stem.includes(`, or ${item.options.at(-1)}?`), false, item.id)
  }
})

test("every voice question belongs to one of the five learning-path courses", () => {
  const courses = new Set<string>(testPack.courses.map((course) => course.id))
  for (const scene of testPack.scenes) assert.equal(courses.has(scene.course ?? ""), true, scene.id)
  for (const course of courses) assert.equal(testPack.scenes.some((scene) => scene.course === course), true, course)
  const parsed = parseGlossary(testPack.glossaryText)
  assert.equal(parsed.ok, true)
  if (!parsed.ok) return
  const items = itemsFromGlossary(parsed.glossary, testPack.scenes)
  assert.equal(items.length, testPack.scenes.length)
  for (const item of items) assert.equal(item.course, testPack.scenes.find((scene) => scene.id === item.id)?.course)
})

// Gemini platform is another name for Gemini Enterprise Agent Platform, recorded in the glossary
// and not a rename, so no scene asks it. Old names of renamed products count through their pair:
// scenes ask the exam-guide name (else the newest name) and show the other beside it as
// "also called". The owner's rule, 19 Oct: exam guide first, then newest name.
const NOT_ASKED = testPack.meta.notAsked ?? []

test("every glossary row is the answer to at least one voice scene", () => {
  const parsed = parseGlossary(testPack.glossaryText)
  assert.equal(parsed.ok, true)
  if (!parsed.ok) return
  const glossary = parsed.glossary
  const answers = new Set(testPack.scenes.map((scene) => scene.correct.toLowerCase()))
  const asked = (name: string) => {
    if (answers.has(name.toLowerCase())) return true
    const pair = glossary.renames.find((item) => [item.oldName, item.newName].some((other) => other.toLowerCase() === name.toLowerCase()))
    return pair !== undefined && (answers.has(pair.oldName.toLowerCase()) || answers.has(pair.newName.toLowerCase()))
  }
  const missing = glossary.terms.map((term) => term.term).filter((name) => !NOT_ASKED.includes(name) && !asked(name))
  assert.deepEqual(missing, [])
  const examTerms = testPack.terms
  assert.deepEqual(examTerms.filter((name) => !NOT_ASKED.includes(name) && !asked(name)), [])
})

test("no voice scene names its own answer", () => {
  for (const scene of testPack.scenes) {
    const name = new RegExp(`\\b${scene.correct.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i")
    assert.equal(name.test(scene.scene) || name.test(scene.constraint), false, scene.id)
  }
})

test("a round asks every question and changes order when the shuffle changes", () => {
  const parsed = parseGlossary(testPack.glossaryText)
  assert.equal(parsed.ok, true)
  if (!parsed.ok) return
  const items = itemsFromGlossary(parsed.glossary, testPack.scenes)
  const lines: ScoreLine[] = []
  const sameOrder = takeRound(items, lines, () => 0.999)
  const otherOrder = takeRound(items, lines, () => 0)
  assert.equal(sameOrder.length, items.length)
  assert.equal(otherOrder.length, items.length)
  assert.deepEqual(sameOrder.map((item) => item.id), items.map((item) => item.id))
  assert.notEqual(otherOrder.map((item) => item.id).join("|"), sameOrder.map((item) => item.id).join("|"))
  assert.equal(parseWeights("Section 1 (fundamentals, ~30%)")[1], 30)
})

test("a renamed product leads with the exam-guide name, the other name as also called", () => {
  const parsed = parseGlossary(testPack.glossaryText)
  assert.equal(parsed.ok, true)
  if (!parsed.ok) return
  const glossary = parsed.glossary
  assert.equal(label(glossary, "Gemini Enterprise Agent Platform"), "**Gemini Enterprise Agent Platform** (also called Vertex AI)")
  assert.equal(label(glossary, "Vertex AI"), "Vertex AI (also called **Gemini Enterprise Agent Platform**)")
  assert.equal(label(glossary, "Customer Experience Agent Studio"), "Customer Experience Agent Studio (also called **Conversational Agents**)")
  assert.equal(label(glossary, "Lite Runtime (LiteRT)"), "Lite Runtime (LiteRT) (also called TensorFlow Lite)")
  assert.equal(preferredName(glossary, "Google AI Pro"), "Gemini Advanced")
  assert.equal(preferredName(glossary, "Vertex AI"), "Gemini Enterprise Agent Platform")
  assert.equal(preferredName(glossary, "TensorFlow Lite"), "Lite Runtime (LiteRT)")
  assert.equal(label(glossary, "Grounding"), "Grounding")
  assert.equal(applyNames(glossary, "Use Vertex AI Search today."), "Use **Agent Search** (also called Vertex AI Search) today.")
  assert.equal(applyNames(glossary, "Try Google AI Pro."), "Try **Gemini Advanced** (also called Google AI Pro).")
  assert.equal(applyNames(glossary, "Try Gemini Advanced."), "Try Gemini Advanced.")
  assert.equal(applyNames(glossary, "Agent Platform (formerly Vertex AI)"), "Agent Platform (formerly Vertex AI)")
  assert.equal(applyNames(glossary, "Formerly called Vertex AI Search."), "Formerly called Vertex AI Search.")
  assert.equal(applyNames(glossary, 'A "Migrating from TensorFlow Lite" guide.'), 'A "Migrating from TensorFlow Lite" guide.')
  assert.equal(label(glossary, "Agent Platform Model Registry"), "Agent Platform Model Registry (also called Model Registry)")
  assert.equal(
    applyNames(glossary, "Formerly called Vertex AI Model Registry; the study guide says Model Registry."),
    "Formerly called Vertex AI Model Registry; the study guide says Agent Platform Model Registry (also called Model Registry).",
  )
  assert.equal(applyNames(glossary, "Track it with Agent Platform Model Registry."), "Track it with Agent Platform Model Registry.")
  const versions = itemsFromGlossary(glossary, testPack.scenes).find((item) => item.id === "which-version")
  assert.equal(versions?.options[versions.correctIndex], "Agent Platform Model Registry (also called Model Registry)")
  assert.match(versions?.why ?? "", /Formerly called Vertex AI Model Registry/)
  assert.match(versions?.why ?? "", /study guide says Agent Platform Model Registry \(also called Model Registry\)/)
  for (const pair of glossary.renames) {
    const names = [pair.oldName, pair.newName].filter((name) => glossary.examNames.includes(name))
    assert.equal(names.length <= 1, true, `${pair.oldName} => ${pair.newName}`)
  }
  const platform = itemsFromGlossary(glossary, testPack.scenes).find((item) => item.id === "managed-platform")
  assert.equal(platform?.options.includes("**Gemini Enterprise Agent Platform** (also called Vertex AI)"), true)
  const plan = itemsFromGlossary(glossary, testPack.scenes).find((item) => item.id === "paid-plan")
  assert.equal(plan?.options[plan.correctIndex], "**Gemini Advanced** (also called Google AI Pro)")
  assert.equal(plainNames("**A** (formerly B)"), "A (formerly B)")
})

test("a round leaves out questions already answered right", () => {
  const parsed = parseGlossary(testPack.glossaryText)
  assert.equal(parsed.ok, true)
  if (!parsed.ok) return
  const items = itemsFromGlossary(parsed.glossary, testPack.scenes)
  const [right, fixedTwice, fixedThrice] = items.map((item) => item.id)
  const answer = (id: string | undefined, missed: boolean): ScoreLine =>
    ({ date: "2026-10-06", session: 1, mode: "round", asked: [id ?? ""], missed: missed ? [id ?? ""] : [] })
  const lines: ScoreLine[] = [
    answer(right, false),
    answer(fixedTwice, true), answer(fixedTwice, false), answer(fixedTwice, false),
    answer(fixedThrice, true), answer(fixedThrice, false), answer(fixedThrice, false), answer(fixedThrice, false),
  ]
  const ids = takeRound(items, lines).map((item) => item.id)
  assert.equal(ids.length, items.length - 2)
  assert.equal(ids.includes(right ?? ""), false)
  assert.equal(ids.includes(fixedTwice ?? ""), true)
  assert.equal(ids.includes(fixedThrice ?? ""), false)
})

test("every voice scene asks a question, and its constraint is a full sentence", () => {
  for (const scene of testPack.scenes) {
    assert.match(scene.scene, /\?$/, `${scene.id}: the scene must end with a question`)
    assert.match(scene.constraint, /^[A-Z].*[.!]$/, `${scene.id}: the constraint must be a sentence`)
    for (const sentence of scene.constraint.split(/(?<=\.) /)) {
      assert.ok(sentence.trim().split(/\s+/).length >= 4, `${scene.id}: "${sentence}" is a fragment`)
    }
  }
})
