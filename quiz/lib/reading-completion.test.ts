import assert from "node:assert/strict"
import test from "node:test"
import { readingCompletion } from "./reading-completion.ts"
import type { Loaded } from "./course-text.ts"
import { loadPack } from "./pack.ts"
import { testRoot } from "./test-pack.ts"

const emptyBundle = { contentObjects: [], articles: [], blocks: [], components: [] }
const loaded = (hasPages: boolean): Loaded => ({
  ok: true,
  bundle: emptyBundle,
  pages: hasPages ? [{ id: "1", title: "Synthetic reading" }] : [],
  ids: [],
})

test("the notice counts public and captured courses this server can read, plus the path's unreadable courses", () => {
  const pack = loadPack(testRoot, "agentic-architect")
  const results = pack.courses.map((course) => loaded(course.provider === "google" || course.template === "1786"))
  assert.deepEqual(readingCompletion(pack, results), {
    readable: 9,
    total: 13,
    unreadable: 4,
    notice: "Unfinished: Read Aloud can read 9 of 13 courses on this server; 4 courses need reading text.",
  })
})

test("missing bundles and empty private stores are unreadable, while a complete pack has no notice", () => {
  const pack = loadPack(testRoot, "agentic-architect")
  const withoutPrivateCopies = pack.courses.map((course) => loaded(course.provider === "google"))
  assert.deepEqual(readingCompletion(pack, withoutPrivateCopies), {
    readable: 8,
    total: 13,
    unreadable: 5,
    notice: "Unfinished: Read Aloud can read 8 of 13 courses on this server; 5 courses need reading text.",
  })
  const allReadable = { ...pack, noReading: [] }
  assert.deepEqual(readingCompletion(allReadable, pack.courses.map(() => loaded(true))), {
    readable: 10,
    total: 10,
    unreadable: 0,
  })

  const unavailable = pack.courses.map(() => loaded(true))
  unavailable[0] = { ok: false, error: "Synthetic unavailable bundle." }
  assert.deepEqual(readingCompletion(pack, unavailable), {
    readable: 9,
    total: 13,
    unreadable: 4,
    notice: "Unfinished: Read Aloud can read 9 of 13 courses on this server; 4 courses need reading text.",
  })
})
