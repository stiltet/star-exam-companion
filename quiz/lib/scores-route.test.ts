import assert from "node:assert/strict"
import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import test, { after } from "node:test"
import { loadPlay, readScores } from "./load.ts"
import { practiceItems, writtenPool } from "./questions.ts"
import { postScores } from "./scores-route.ts"
import type { Answer } from "./score.ts"
import { testBank, testPack } from "./test-pack.ts"

// A test reads the default exam, whatever exam this machine has chosen on the Progress page.
process.env.QUIZ_EXAM_SETTING_FILE = "/nonexistent/active-exam.json"

const scratch = mkdtempSync(path.join(tmpdir(), "quiz-scores-route-"))
const before = { cwd: process.cwd(), scores: process.env.QUIZ_SCORES_FILE }
const quiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const file = path.join(scratch, "scores.jsonl")
process.chdir(quiz)
process.env.QUIZ_SCORES_FILE = file
after(() => {
  process.chdir(before.cwd)
  if (before.scores === undefined) delete process.env.QUIZ_SCORES_FILE
  else process.env.QUIZ_SCORES_FILE = before.scores
  rmSync(scratch, { recursive: true, force: true })
})

const answer = (n: number, extra: Partial<Answer> = {}): Answer => ({
  id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
  at: new Date().toISOString(), mode: "practice", asked: ["q1"], missed: [], ...extra,
})
const request = (answers: Answer[], origin = "http://localhost") => new Request("http://localhost/api/scores", {
  method: "POST",
  headers: { host: "localhost", origin, "content-type": "application/json" },
  body: JSON.stringify({ answers }),
})

test("Next's score route exports exactly the handler these API tests exercise", () => {
  assert.equal(readFileSync(path.join(quiz, "app/api/scores/route.ts"), "utf8").trim(), 'export { postScores as POST } from "@/lib/scores-route"')
})

test("the actual score handler stores every offered question, including written questions, once", async () => {
  const play = loadPlay()
  assert.ok(play.ok)
  if (!play.ok) return
  const practice = practiceItems(play.items, writtenPool(testBank)).map((item, n) => answer(n + 1, { asked: [item.id], missed: n % 2 ? [item.id] : [] }))
  const round = play.items.map((item, n) => answer(n + 1001, { mode: "round", asked: [item.id] }))
  const exam = answer(2001, { mode: "exam", asked: ["q1", play.items[0]!.id], missed: ["q1"], seconds: 420 })
  const cards = answer(2002, { mode: "flashcard", asked: [play.glossary.terms[0]!.term] })
  for (const batch of [practice, round, [exam, cards]]) {
    const response = await postScores(request(batch))
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { ok: true, stored: batch.map((item) => item.id), duplicate: [], rejected: [], gone: [], reasons: {} })
    const duplicate = await postScores(request(batch))
    assert.deepEqual(await duplicate.json(), { ok: true, stored: [], duplicate: batch.map((item) => item.id), rejected: [], gone: [], reasons: {} })
  }
  const saved = readScores(file).lines
  const originals = [...practice, ...round, exam, cards]
  assert.equal(saved.length, originals.length)
  for (const original of originals) {
    const stored = saved.find((line) => line.id === original.id)
    assert.ok(stored)
    assert.equal(stored.at, original.at)
    assert.deepEqual(stored.asked, original.asked)
    assert.deepEqual(stored.missed, original.missed)
    assert.equal(stored.seconds, original.seconds)
  }
})

test("the actual handler keeps mode, time and origin validation and explains individual refusals", async () => {
  const invalid = [
    answer(3001, { mode: "round" }),
    answer(3002, { asked: ["not-a-question"] }),
    answer(3003, { at: new Date(Date.now() + 60 * 60 * 1000).toISOString() }),
    answer(3004, { mode: "exam", seconds: 5401 }),
  ]
  const count = readScores(file).lines.length
  const response = await postScores(request(invalid))
  const body = await response.json()
  assert.equal(response.status, 200)
  assert.deepEqual(body.stored, [])
  assert.deepEqual(body.rejected, invalid.map((item) => item.id))
  assert.deepEqual(body.gone, [invalid[1]!.id])
  assert.match(body.reasons[invalid[0]!.id], /question bank/)
  assert.match(body.reasons[invalid[2]!.id], /clock/)
  assert.match(body.reasons[invalid[3]!.id], /duration/)
  assert.equal((await postScores(request([answer(4001)], "http://other.example"))).status, 400)
  assert.equal(readScores(file).lines.length, count)
})
