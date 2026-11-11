import assert from "node:assert/strict"
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import test from "node:test"
import { MAX_VALUE_CHARS, createDebugLog, describeError, formatLine, logFileFor, maskAddress } from "./debug-log.ts"

// Every address, name and value below is made up.

test("a line holds the time, the event and its values in the order given, quoting what needs it", () => {
  const line = formatLine(new Date("2026-01-02T03:04:05.000Z"), "lesson.done", { n: 3, title: "A made-up lesson", ok: true, empty: "", gone: null })
  assert.equal(line, '2026-01-02T03:04:05.000Z  lesson.done  n=3  title="A made-up lesson"  ok=true  empty=""  gone=""\n')
})

test("a long value is cut, so no page of text can end up in the log by mistake", () => {
  const line = formatLine(new Date(0), "x", { value: "a".repeat(MAX_VALUE_CHARS + 50) })
  assert.ok(line.includes("…"))
  assert.ok(line.length < MAX_VALUE_CHARS + 80)
})

test("an address is written without the numbers in it", () => {
  assert.equal(maskAddress("https://www.example.test/course_templates/123/html_bundles/456?x=1"), "www.example.test/course_templates/N/html_bundles/N")
  assert.equal(maskAddress("not an address 42"), "not an address N")
})

test("an error is described by the first line of its message, cut short", () => {
  assert.equal(describeError(new Error("page.goto: Timeout 60000ms exceeded.\nCall log:\n  - navigating")), "page.goto: Timeout 60000ms exceeded.")
  assert.equal(describeError("plain text"), "plain text")
  assert.ok(describeError(new Error("x".repeat(1000))).length <= MAX_VALUE_CHARS)
})

test("the file sits in a logs folder beside the private store, one file per run, named by the time", () => {
  const file = logFileFor("/data/app/private-reading", "reading-crawl", new Date("2026-01-02T03:04:05.000Z"))
  assert.equal(file, path.join("/data/app", "logs", "reading-crawl-20260102-030405.log"))
})

test("a log writes its lines to the file, keeps debug lines only when verbose, and the file is private", async (t) => {
  const base = await mkdtemp(path.join(tmpdir(), "debug-log-"))
  t.after(() => rm(base, { recursive: true, force: true }))
  const quiet = createDebugLog({ file: path.join(base, "logs", "quiet.log"), verbose: false, now: () => new Date(0) })
  quiet.log("run.start", { target: "all" })
  quiet.debug("lesson.goto", { address: "x" })
  assert.equal(await readFile(path.join(base, "logs", "quiet.log"), "utf8"), "1970-01-01T00:00:00.000Z  run.start  target=all\n")
  const verbose = createDebugLog({ file: path.join(base, "logs", "verbose.log"), verbose: true, now: () => new Date(0) })
  verbose.log("run.start")
  verbose.debug("lesson.goto", { address: "x" })
  assert.equal((await readFile(path.join(base, "logs", "verbose.log"), "utf8")).split("\n").filter(Boolean).length, 2)
  assert.equal((await stat(path.join(base, "logs", "verbose.log"))).mode & 0o777, 0o600)
})

test("a log with no file does nothing, and a file that cannot be written never breaks the run", async (t) => {
  const none = createDebugLog({ file: null, verbose: true })
  assert.equal(none.path, null)
  none.log("a")
  none.debug("b")
  const base = await mkdtemp(path.join(tmpdir(), "debug-log-"))
  t.after(() => rm(base, { recursive: true, force: true }))
  // A file inside a folder that is really a file cannot be created.
  await writeFile(path.join(base, "not-a-folder"), "x")
  const blocked = createDebugLog({ file: path.join(base, "not-a-folder", "x.log"), verbose: false })
  assert.doesNotThrow(() => blocked.log("event", { a: 1 }))
})
