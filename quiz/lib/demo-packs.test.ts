import assert from "node:assert/strict"
import test from "node:test"
import { demoPacks } from "./static-demo.ts"

test("the demo links the default exam at the site root and every other exam under its own name", () => {
  const packs = demoPacks("generative-ai-leader=Generative AI Leader;agentic-architect=Professional Agentic Architect", "/star-exam-companion", "generative-ai-leader", "agentic-architect")
  assert.deepEqual(packs.map((pack) => [pack.id, pack.href, pack.current]), [
    ["generative-ai-leader", "/star-exam-companion/", false],
    ["agentic-architect", "/star-exam-companion/agentic-architect/", true],
  ])
  assert.equal(packs[1]?.title, "Professional Agentic Architect")
})

test("a local build, which sets no packs, lists none", () => {
  assert.deepEqual(demoPacks("", "", "", ""), [])
})
