import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { spawnSync } from "node:child_process"
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import test, { type TestContext } from "node:test"
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
