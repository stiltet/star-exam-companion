import assert from "node:assert/strict"
import test from "node:test"
import { parseScoreLines } from "./learn.ts"

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
