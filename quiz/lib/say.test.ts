import assert from "node:assert/strict"
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import test, { after } from "node:test"
import { clipFor, READING_POOL, renderSpeech, VOICE_POOL } from "./say.ts"
import { MAX_CACHED_CLIPS, MAX_READING_CLIPS } from "./speak.ts"

const scratch = mkdtempSync(path.join(tmpdir(), "say-"))
after(() => rmSync(scratch, { recursive: true, force: true }))

// A fake `say` first on PATH: logs each call, writes stdin to the -o file, or fails on request.
const bin = path.join(scratch, "bin")
mkdirSync(bin)
const log = path.join(scratch, "calls.log")
writeFileSync(path.join(bin, "say"), `#!/bin/bash
echo "$*" >> "${log}"
out=""
while [ $# -gt 0 ]; do [ "$1" = "-o" ] && out="$2"; shift; done
text="$(cat)"
[ "$text" = "slow" ] && exec sleep 30
[ "$text" = "fail" ] && exit 1
printf 'RIFF%s' "$text" > "$out"
`)
chmodSync(path.join(bin, "say"), 0o755)
process.env.PATH = `${bin}:${process.env.PATH}`

test("a line is rendered once in the Mac's format and then served from the cache", async () => {
  const dir = path.join(scratch, "clips")
  const first = await clipFor("Correct.", { dir, keep: MAX_CACHED_CLIPS })
  assert.equal(first?.toString(), "RIFFCorrect.")
  assert.equal((await clipFor("Correct.", { dir, keep: MAX_CACHED_CLIPS }))?.toString(), "RIFFCorrect.")
  const calls = readFileSync(log, "utf8").trim().split("\n")
  assert.equal(calls.length, 1)
  assert.match(calls[0] ?? "", /--file-format=WAVE --data-format=LEI16@22050/)
  assert.doesNotMatch(calls[0] ?? "", /-v /, "no voice is chosen, so the Mac's System voice speaks")
})

test("a failed `say` serves nothing and leaves no partial clip behind", async () => {
  const dir = path.join(scratch, "failing")
  assert.equal(await clipFor("fail", { dir, keep: MAX_CACHED_CLIPS }), null)
  assert.deepEqual(readdirSync(dir), [])
  assert.equal(existsSync(path.join(dir, "x.partial")), false)
})

test("each pool keeps its own cap, so one pool's clips never evict another's", async () => {
  const quiz = path.join(scratch, "quiz-pool")
  const reading = path.join(scratch, "reading-pool")
  await clipFor("Quiz line.", { dir: quiz, keep: 5 })
  for (const line of ["One.", "Two.", "Three."]) await clipFor(line, { dir: reading, keep: 2 })
  assert.equal(readdirSync(quiz).length, 1)
  assert.equal(readdirSync(reading).filter((name) => name.endsWith(".wav")).length, 2)
  assert.equal(statSync(reading).mode & 0o777, 0o700, "a new pool's folder is readable by this user only")
  // The real pools never share a folder, and Read Aloud's has its own cap.
  assert.notEqual(READING_POOL.dir, VOICE_POOL.dir)
  assert.equal(READING_POOL.keep, MAX_READING_CLIPS)
  assert.equal(VOICE_POOL.keep, MAX_CACHED_CLIPS)
})

test("a say that runs too long is stopped and leaves nothing to play", async () => {
  const file = path.join(scratch, "slow.wav")
  const started = Date.now()
  assert.equal(await renderSpeech("slow", file, 400), false)
  assert.ok(Date.now() - started < 5000)
  assert.equal(existsSync(file), false)
})

test("a pool folder left readable by others is tightened to this user", async () => {
  const loose = path.join(scratch, "loose-pool")
  mkdirSync(loose, { mode: 0o755 })
  chmodSync(loose, 0o755)
  await clipFor("Tight.", { dir: loose, keep: 5 })
  assert.equal(statSync(loose).mode & 0o777, 0o700)
})
