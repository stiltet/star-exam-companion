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

test("the notice counts public and captured courses this server can read, and the notice clears when all of them are readable", () => {
  const pack = loadPack(testRoot, "agentic-architect")
  const results = pack.courses.map((course) => loaded(course.template !== "1385"))
  assert.deepEqual(readingCompletion(pack, results), {
    readable: 7,
    total: 8,
    unreadable: 1,
    notice: "Unfinished: Read Aloud can read 7 of 8 courses on this server; 1 course needs reading text.",
  })
})

test("missing bundles and empty private stores are unreadable, while a complete pack has no notice", () => {
  const pack = loadPack(testRoot, "agentic-architect")
  const withoutPrivateCopies = pack.courses.map((course) => loaded(false))
  assert.deepEqual(readingCompletion(pack, withoutPrivateCopies), {
    readable: 0,
    total: 8,
    unreadable: 8,
    notice: "Unfinished: Read Aloud can read 0 of 8 courses on this server; 8 courses need reading text.",
  })
  // Every course that can have text is readable: a course Google lists with no reading text would not keep the notice up.
  assert.deepEqual(readingCompletion(pack, pack.courses.map(() => loaded(true))), {
    readable: 8,
    total: 8,
    unreadable: 0,
  })

  const unavailable = pack.courses.map(() => loaded(true))
  unavailable[0] = { ok: false, error: "Synthetic unavailable bundle." }
  assert.deepEqual(readingCompletion(pack, unavailable), {
    readable: 7,
    total: 8,
    unreadable: 1,
    notice: "Unfinished: Read Aloud can read 7 of 8 courses on this server; 1 course needs reading text.",
  })
})
