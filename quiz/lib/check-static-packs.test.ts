import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { spawnSync } from "node:child_process"
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import test, { type TestContext } from "node:test"
import { INDEX_FROM, indexParts, leakIn } from "./check-static-packs.ts"
import { testRoot } from "./test-pack.ts"

function fixture(t: TestContext) {
  const scratch = mkdtempSync(path.join(tmpdir(), "static-privacy-"))
  t.after(() => rmSync(scratch, { recursive: true, force: true }))
  const root = path.join(scratch, "source")
  const store = path.join(scratch, "private")
  mkdirSync(path.join(root, "quiz"), { recursive: true })
  mkdirSync(path.join(root, "pages-static"), { recursive: true })
  cpSync(path.join(testRoot, "exams"), path.join(root, "exams"), { recursive: true })
  const course = path.join(store, "removed-pack", "99")
  mkdirSync(course, { recursive: true })
  const text = ["Synthetic guarded private sentence for the static privacy guard test.", "Second fixture line, long enough to be compared."].join("\n")
  writeFileSync(path.join(course, `${createHash("sha256").update("101").digest("hex")}.json`), JSON.stringify({
    pageId: "101", title: "Synthetic fixture", text, savedAt: "2026-01-01T00:00:00.000Z",
  }))
  const run = () => spawnSync(process.execPath, [path.join(testRoot, "quiz/lib/check-static-packs.ts"), root], {
    encoding: "utf8", env: { ...process.env, QUIZ_ROOT: root, QUIZ_PRIVATE_DIR: store },
  })
  return { root, store, text, run }
}

test("the static privacy guard accepts source trees with the private store outside them", (t) => {
  const { run } = fixture(t)
  const result = run()
  assert.equal(result.status, 0, result.stderr)
})

for (const folder of ["quiz", "pages-static", "exams/agentic-architect"]) {
  test(`the static privacy guard rejects captured text in ${folder}, including orphan captures`, (t) => {
    const { root, text, run } = fixture(t)
    writeFileSync(path.join(root, folder, "synthetic.json"), JSON.stringify({ description: text }))
    const result = run()
    assert.equal(result.status, 1)
    assert.match(result.stderr, /contain text from the private reading store/)
    assert.equal(result.stderr.includes(text), false)
  })
}

test("a captured page that repeats its course's public title is no leak, while its other lines still are", (t) => {
  const { root, store, run } = fixture(t)
  const pack = JSON.parse(readFileSync(path.join(root, "exams/agentic-architect/courses.json"), "utf8")) as { courses: { title: string }[]; noReading?: { title: string; why: string }[] }
  const title = [...pack.courses.map((course) => course.title), ...(pack.noReading ?? []).flatMap((course) => [course.title, course.why])].find((text) => text.length >= 40)!
  assert.ok(title, "the fixture's pack says something public long enough to be compared")
  const course = path.join(store, "agentic-architect", "1")
  mkdirSync(course, { recursive: true })
  writeFileSync(path.join(course, `${createHash("sha256").update("202").digest("hex")}.json`), JSON.stringify({
    pageId: "202", title: "Synthetic title", text: `${title}\nThis synthetic line is private and at least forty characters long.`, savedAt: "2026-01-01T00:00:00.000Z",
  }))
  writeFileSync(path.join(root, "quiz", "public-title.txt"), title)
  assert.equal(run().status, 0, "a source file that holds only the public title passes")
  writeFileSync(path.join(root, "quiz", "private-line.txt"), "This synthetic line is private and at least forty characters long.")
  assert.equal(run().status, 1, "the private line still fails")
})

test("the static privacy guard rejects a configured store path without printing it", (t) => {
  const { root, store, run } = fixture(t)
  writeFileSync(path.join(root, "quiz/synthetic.json"), JSON.stringify({ location: store }))
  const result = run()
  assert.equal(result.status, 1)
  assert.match(result.stderr, /contain the private reading store path/)
  assert.equal(result.stderr.includes(store), false)
})

// A tracked source file is still checked when its name only starts like a local file's.
for (const name of ["scores.ts", "scores-panel.tsx", ".env.ts", ".environment.json"]) {
  test(`the static privacy guard still checks ${name}, which is not a local-only file`, (t) => {
    const { root, text, run } = fixture(t)
    writeFileSync(path.join(root, "quiz", name), name.endsWith(".json") ? JSON.stringify({ text }) : text)
    const result = run()
    assert.equal(result.status, 1, name)
    assert.match(result.stderr, /contain text from the private reading store/)
  })
}

// The local files that really never reach a build are skipped, by exact name.
for (const name of ["scores-agentic-architect.jsonl", ".env.local", "active-exam.json"]) {
  test(`the static privacy guard skips the local file ${name}`, (t) => {
    const { root, text, run } = fixture(t)
    writeFileSync(path.join(root, "quiz", name), text)
    assert.equal(run().status, 0, name)
  })
}

test("a short capture such as one word does not block the build", (t) => {
  const { root, store, run } = fixture(t)
  const course = path.join(store, "removed-pack", "99")
  writeFileSync(path.join(course, `${createHash("sha256").update("102").digest("hex")}.json`), JSON.stringify({
    pageId: "102", title: "Synthetic short", text: "Continue", savedAt: "2026-01-01T00:00:00.000Z",
  }))
  writeFileSync(path.join(root, "quiz", "button.json"), JSON.stringify({ label: "Continue" }))
  assert.equal(run().status, 0)
})

function addCapture(store: string, pageId: string, text: string) {
  const course = path.join(store, "removed-pack", "99")
  writeFileSync(path.join(course, `${createHash("sha256").update(pageId).digest("hex")}.json`), JSON.stringify({
    pageId, title: "Synthetic", text, savedAt: "2026-01-01T00:00:00.000Z",
  }))
}

test("a 64 character capture, the size of the browser tests' own fixture, is checked and blocks the build", (t) => {
  const { root, store, run } = fixture(t)
  // Joined, so the whole sentence never appears in a tracked file: the browser test server refuses that.
  const text = ["Synthetic private fixture", "used only by the offline browser test."].join(" ")
  assert.equal(text.length, 64)
  addCapture(store, "103", text)
  writeFileSync(path.join(root, "quiz", "leak.json"), JSON.stringify({ text }))
  const result = run()
  assert.equal(result.status, 1)
  assert.match(result.stderr, /contain text from the private reading store/)
})

test("a line is compared from 40 characters: 39 pass and 40 block", (t) => {
  const { root, store, run } = fixture(t)
  addCapture(store, "104", "x".repeat(39))
  writeFileSync(path.join(root, "quiz", "edge.json"), JSON.stringify({ text: "x".repeat(39) }))
  assert.equal(run().status, 0, "39 characters are not compared")
  addCapture(store, "105", "y".repeat(40))
  writeFileSync(path.join(root, "quiz", "edge2.json"), JSON.stringify({ text: "y".repeat(40) }))
  assert.equal(run().status, 1, "40 characters are compared")
})

test("one long line of a capture of many short lines is enough to block the build", (t) => {
  const { root, store, run } = fixture(t)
  const long = "A line of the reading that is well over forty characters long."
  addCapture(store, "106", ["Short.", long, "Also short."].join("\n"))
  writeFileSync(path.join(root, "quiz", "one-line.json"), JSON.stringify({ quote: long }))
  assert.equal(run().status, 1)
})

test("a capture of hundreds of long lines is found by one of them in a large source, and a source with none passes", (t) => {
  const { root, store, run } = fixture(t)
  const lines = Array.from({ length: 300 }, (_, number) => `Synthetic captured line number ${number} that is long enough to be compared.`)
  addCapture(store, "107", lines.join("\n"))
  const ordinary = Array.from({ length: 2000 }, (_, number) => `Ordinary interface sentence ${number}, nothing to do with any capture.`).join("\n")
  writeFileSync(path.join(root, "quiz", "large.txt"), ordinary)
  assert.equal(run().status, 0, "a large source with none of the lines passes")
  writeFileSync(path.join(root, "quiz", "large.txt"), `${ordinary}\n${lines[150]}`)
  assert.equal(run().status, 1, "one captured line in a large source blocks the build")
})

test("the index is used from 50 captured parts up, and finds a leak the same way either side", (t) => {
  const scratch = mkdtempSync(path.join(tmpdir(), "index-boundary-"))
  t.after(() => rmSync(scratch, { recursive: true, force: true }))
  const part = (n: number) => `Synthetic captured line number ${String(n).padStart(3, "0")} for the boundary.`
  const leaking = path.join(scratch, "leaking.txt")
  const clean = path.join(scratch, "clean.txt")
  writeFileSync(leaking, `before ${part(7)} after`)
  writeFileSync(clean, "nothing captured here at all, only ordinary words")
  for (const count of [49, 50]) {
    const captured = indexParts(Array.from({ length: count }, (_, n) => part(n)))
    assert.equal(captured.index === null, count < INDEX_FROM, `${count} parts`)
    assert.equal(leakIn(leaking, "/nowhere", captured), "text", `${count} parts, leaking file`)
    assert.equal(leakIn(clean, "/nowhere", captured), null, `${count} parts, clean file`)
  }
})
