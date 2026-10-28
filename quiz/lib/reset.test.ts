import assert from "node:assert/strict"
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import test, { after } from "node:test"
import { acceptReset, BACKUP_DIR, backupName, resetScores } from "./reset.ts"

const origin = "http://127.0.0.1:3000"

// Every temp directory a test makes is removed when the file finishes.
const made: string[] = []
const tempDir = () => {
  const dir = mkdtempSync(path.join(tmpdir(), "reset-"))
  made.push(dir)
  return dir
}
after(() => made.forEach((dir) => rmSync(dir, { recursive: true, force: true })))

test("a reset is accepted only with an explicit confirm from the same origin", () => {
  const good = { origin, contentType: "application/json", body: { confirm: true }, allowedOrigin: origin }
  assert.equal(acceptReset(good), true)
  assert.equal(acceptReset({ ...good, body: {} }), false)
  assert.equal(acceptReset({ ...good, body: { confirm: "yes" } }), false)
  assert.equal(acceptReset({ ...good, body: { confirm: true, extra: 1 } }), false)
  assert.equal(acceptReset({ ...good, origin: "http://evil.test" }), false)
  assert.equal(acceptReset({ ...good, contentType: "text/plain" }), false)
})

test("a reset backs the scores up before it empties them", () => {
  const dir = tempDir()
  const lines = '{"date":"2026-09-30","session":1,"mode":"round","asked":["a"],"missed":[]}\n'
  writeFileSync(path.join(dir, "scores.jsonl"), lines)
  const now = new Date("2026-09-30T21:15:00.123Z")
  const backup = resetScores(path.join(dir, "scores.jsonl"), now)
  assert.equal(backup, path.join(dir, BACKUP_DIR, backupName(now)))
  assert.equal(readFileSync(backup ?? "", "utf8"), lines)
  assert.equal(readFileSync(path.join(dir, "scores.jsonl"), "utf8"), "")
  // A second reset at the same instant never overwrites the first backup.
  resetScores(path.join(dir, "scores.jsonl"), now)
  assert.equal(readFileSync(backup ?? "", "utf8"), lines)
  assert.equal(readdirSync(path.join(dir, BACKUP_DIR)).length, 2)
})

test("a reset with no score file creates an empty one and no backup", () => {
  const dir = tempDir()
  assert.equal(resetScores(path.join(dir, "scores.jsonl"), new Date()), null)
  assert.equal(readFileSync(path.join(dir, "scores.jsonl"), "utf8"), "")
  assert.equal(existsSync(path.join(dir, BACKUP_DIR)), false)
})

test("two resets in the same millisecond keep both backups", () => {
  const dir = tempDir()
  const now = new Date("2026-10-01T08:00:00.000Z")
  writeFileSync(path.join(dir, "scores.jsonl"), "first\n")
  const one = resetScores(path.join(dir, "scores.jsonl"), now)
  writeFileSync(path.join(dir, "scores.jsonl"), "second\n")
  const two = resetScores(path.join(dir, "scores.jsonl"), now)
  assert.notEqual(one, two)
  assert.equal(readFileSync(one!, "utf8"), "first\n")
  assert.equal(readFileSync(two!, "utf8"), "second\n")
})
