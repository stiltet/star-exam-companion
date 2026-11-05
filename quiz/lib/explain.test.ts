import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { explanationParts, explanationShown } from "./score.ts"
import { words } from "./spoken-word.ts"
import { itemsFromGlossary, reasonFrom, sourceText } from "./round.ts"
import { parseGlossary } from "./sources.ts"
import { testBank, testPack } from "./test-pack.ts"

function realItems() {
  const parsed = parseGlossary(testPack.glossaryText)
  if (!parsed.ok) throw new Error(`glossary row ${parsed.row}: ${parsed.error}`)
  return itemsFromGlossary(parsed.glossary, testPack.scenes)
}

test("every question carries why its answer is right, from glossary.md, with its source", () => {
  for (const item of realItems()) {
    assert.ok(item.why.trim().length > 0, item.id)
    assert.ok(item.whySource.trim().length > 0, item.id)
    assert.equal(/\*\*(Renamed|Exam guide):\*\*/.test(item.why), false, item.id)
    assert.equal(item.whySource.includes("]("), false, item.id)
  }
})

test("the reason leaves out the rename markers and keeps the meaning", () => {
  assert.equal(reasonFrom("CX agents for customers. **Exam guide:** Conversational Agents."), "CX agents for customers.")
  assert.equal(reasonFrom("Supports live human agents."), "Supports live human agents.")
  assert.equal(sourceText("SG p.5, EG, [Google page](https://cloud.google.com/x)"), "SG p.5, EG, Google page")
})

test("a wrong answer says the answer, why, then the binding constraint, in that order", () => {
  const item = { options: ["Fine-tuning", "Grounding"], correctIndex: 1, why: "Connects output to sources.", constraint: "The facts are wrong." }
  assert.deepEqual(explanationParts(item), [
    "Incorrect. The answer is Grounding.",
    "Why Grounding.",
    "Connects output to sources.",
    "Binding constraint.",
    "The facts are wrong.",
  ])
})

test("a managed-platform explanation names the product with both of its names", () => {
  const platform = realItems().find((item) => item.id === "managed-platform")
  assert.ok(platform)
  assert.equal(explanationParts(platform)[0], `Incorrect. The answer is ${platform.options[platform.correctIndex]}.`)
})

test("the marked explanation uses the same words as the line being said", () => {
  const labelSpoken = words("Binding constraint.").map((word) => word.trim().length)
  const labelShown = words("Binding constraint: ").map((word) => word.trim().length)
  assert.deepEqual(labelShown, labelSpoken)
  for (const item of realItems()) {
    const said = explanationParts(item)
    const shown = explanationShown(item)
    assert.equal(shown.length, said.length, item.id)
    for (let index = 0; index < said.length; index += 1) {
      assert.equal(words(shown[index] ?? "").length, words((said[index] ?? "").replace(/\*\*/g, "")).length, `${item.id} part ${index}`)
    }
  }
})
