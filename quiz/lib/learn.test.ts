import assert from "node:assert/strict"
import test from "node:test"
import { parseScoreLines, parseSections } from "./learn.ts"

const good = '{"date":"2026-10-01","session":1,"mode":"round","asked":["a"],"missed":[]}'

test("every readable line loads", () => {
  assert.deepEqual(parseScoreLines(`${good}\n${good}\n`), { lines: [JSON.parse(good), JSON.parse(good)], skipped: 0 })
  assert.deepEqual(parseScoreLines(""), { lines: [], skipped: 0 })
})

test("a torn or foreign line is skipped and counted, and the rest still load", () => {
  const result = parseScoreLines(`${good}\n{"date":"2026-10-01","sess\n{"hello":1}\n${good}\n`)
  assert.equal(result.lines.length, 2)
  assert.equal(result.skipped, 2)
})

test("a section line may give its weight with a decimal, such as 17.5%, and none is dropped", () => {
  const plan = "- Section 1 (First part, ~25%)\n- Section 2 (Second part, ~17.5%)\n- Section 3 (Third part, ~57.5%)\n"
  assert.deepEqual(parseSections(plan), [
    { id: 1, title: "First part", weight: 25 },
    { id: 2, title: "Second part", weight: 17.5 },
    { id: 3, title: "Third part", weight: 57.5 },
  ])
})
