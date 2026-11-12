import assert from "node:assert/strict"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import test from "node:test"
import { jsonForScript, startFakeSite } from "./fake-lesson-site.ts"
import {
  PAUSE_MAX_MS,
  PAUSE_MIN_MS,
  LISTING_VERSION,
  compareLessons,
  estimateLeftMs,
  finalReport,
  lessonPageId,
  manifestFile,
  progressLine,
  randomPauseMs,
  readManifest,
  textHash,
  verdict,
  verdictLine,
  writeManifest,
  type CourseResult,
  type Manifest,
} from "./reading-crawl.ts"
import { PRIVATE_PAGE_ID } from "./page-id.ts"

// Every title, address and text below is made up.
const lessons = [
  { title: "Alpha", href: "/course_templates/9001/html_bundles/111" },
  { title: "Beta", href: "/course_templates/9001/html_bundles/222" },
  { title: "Gamma", href: "/course_templates/9001/html_bundles/333" },
]
const manifest: Manifest = {
  checkedAt: "2026-01-01T00:00:00.000Z",
  listing: LISTING_VERSION,
  lessons: lessons.map((lesson) => ({ ...lesson, pageId: lessonPageId(lesson.href), hash: textHash(lesson.title) })),
}

function result(over: Partial<CourseResult> = {}): CourseResult {
  return {
    listed: 3,
    saved: 3,
    already: 0,
    empty: [],
    failed: [],
    textChanged: [],
    unaccounted: [],
    comparison: compareLessons(manifest, lessons),
    ...over,
  }
}

test("the pause is uniform between 2 and 15 seconds and drawn fresh each time", () => {
  assert.equal(randomPauseMs(() => 0), PAUSE_MIN_MS)
  assert.equal(randomPauseMs(() => 1), PAUSE_MAX_MS)
  assert.equal(PAUSE_MIN_MS, 2000)
  assert.equal(PAUSE_MAX_MS, 15000)
  const draws = new Set(Array.from({ length: 50 }, () => randomPauseMs()))
  assert.ok(draws.size > 10)
  for (const value of draws) assert.ok(value >= 2000 && value <= 15000)
})

test("a lesson's page id is its bundle number, and always a valid store id", () => {
  assert.equal(lessonPageId("/course_templates/9001/html_bundles/12345"), "12345")
  assert.equal(lessonPageId("/course_sessions/7/html_bundles/12345?x=1"), "12345")
  assert.equal(lessonPageId("/course_templates/9001/documents/67890"), "67890")
  const fallback = lessonPageId("/somewhere/else")
  assert.match(fallback, PRIVATE_PAGE_ID)
  assert.equal(fallback, lessonPageId("/somewhere/else"))
})

test("the manifest comparison names added, removed, reordered and moved lessons", () => {
  assert.equal(compareLessons(null, lessons).first, true)
  assert.deepEqual(compareLessons(manifest, lessons), { first: false, added: [], removed: [], reordered: false, addressChanged: [] })
  const changed = compareLessons(manifest, [lessons[1], lessons[0], { title: "Delta", href: "/x/html_bundles/444" }, { ...lessons[2], href: "/y/html_bundles/999" }])
  assert.deepEqual(changed.added, ["Delta"])
  assert.deepEqual(changed.removed, [])
  assert.equal(changed.reordered, true)
  assert.deepEqual(changed.addressChanged, ["Gamma"])
  assert.deepEqual(compareLessons(manifest, [lessons[0], lessons[1]]).removed, ["Gamma"])
})

test("lessons with the same title are matched by their place, so a repeated title is not reported as changed", () => {
  const repeated = [
    { title: "Intro", href: "/c/html_bundles/1" },
    { title: "Knowledge check", href: "/c/html_bundles/2" },
    { title: "Module", href: "/c/html_bundles/3" },
    { title: "Knowledge check", href: "/c/html_bundles/4" },
  ]
  const saved: Manifest = { checkedAt: "2026-01-01T00:00:00.000Z", listing: LISTING_VERSION, lessons: repeated.map((lesson) => ({ ...lesson, pageId: lessonPageId(lesson.href), hash: null })) }
  assert.deepEqual(compareLessons(saved, repeated), { first: false, added: [], removed: [], reordered: false, addressChanged: [] })
  const moved = compareLessons(saved, [repeated[0], repeated[1], repeated[2], { title: "Knowledge check", href: "/c/html_bundles/9" }])
  assert.deepEqual(moved.addressChanged, ["Knowledge check"])
  assert.deepEqual(compareLessons(saved, repeated.slice(0, 3)).removed, ["Knowledge check"])
})

test("the verdict is complete and current only when every lesson is accounted for and nothing changed", () => {
  assert.deepEqual(verdict(result()), { kind: "current" })
  assert.deepEqual(verdict(result({ saved: 1, already: 2 })), { kind: "current" })
})

test("the verdict is incomplete, naming the gap, when the counts do not add up or lessons are empty or failed", () => {
  const short = verdict(result({ saved: 2 }))
  assert.equal(short.kind, "incomplete")
  assert.match(JSON.stringify(short), /lists 3 lessons but 2 are accounted for/)
  assert.equal(verdict(result({ saved: 2, empty: ["Gamma"] })).kind, "incomplete")
  assert.equal(verdict(result({ saved: 2, failed: ["Gamma"] })).kind, "incomplete")
  assert.equal(verdict(result({ unaccounted: ["Gamma"] })).kind, "incomplete")
})

test("the verdict says Google changed, and what, for a complete course that differs from the manifest", () => {
  const moved = verdict(result({ comparison: compareLessons(manifest, [lessons[1], lessons[0], lessons[2]]) }))
  assert.deepEqual(moved, { kind: "changed", what: ["lessons reordered"] })
  const text = verdict(result({ textChanged: ["Alpha"] }))
  assert.deepEqual(text, { kind: "changed", what: ["1 lesson text(s) changed"] })
  assert.match(verdictLine("9001", "Made-up course", text), /^Course 9001 \(Made-up course\): complete but Google changed: 1 lesson text/)
  assert.match(verdictLine("9001", "Made-up course", { kind: "current" }), /complete and current\.$/)
})

test("a course with nothing to read is named with what it holds instead, and is not a failure", () => {
  const good = { id: "9001", title: "Made-up course", result: result() }
  const labs = { id: "9003", title: "Labs only course", result: result({ listed: 0, saved: 0, comparison: compareLessons(null, []) }), noLessons: "2 labs, 1 video" }
  const text = finalReport({ courses: [good, labs], stopped: null, page: 3, total: 3, elapsedMs: 1000 }, false)
  assert.match(text, /✔ FINISHED: all 3 lessons checked in 2 courses/)
  assert.match(text, /– 9003\. Labs only course\n {6}no readable lessons: 2 labs, 1 video/)
  assert.doesNotMatch(text, /✖/)
  for (const columns of [30, 50]) for (const line of finalReport({ courses: [good, labs], stopped: null, page: 3, total: 3, elapsedMs: 1000 }, false, columns).split("\n")) assert.ok(line.length <= columns, `fits ${columns}: ${line}`)
})

test("progress shows a bar, page, counts, time and the pause countdown in a terminal, and cuts the title first", () => {
  const state = { page: 23, total: 78, course: "9001", title: "Beta", saved: 2, updated: 3, same: 17, empty: 1, failed: 0, elapsedMs: 230_000, pauseLeft: 7 }
  const line = progressLine(state, true, 200)
  assert.match(line, /^█+░+ 23\/78  2 new · 3 updated · 17 same · 1 empty · 0 failed  ~9 min 10 s left  next page in 7 s  9001: Beta$/)
  // Never wider than the terminal, so a redraw never wraps onto a new row.
  for (const columns of [120, 90, 70, 50, 40]) assert.ok(progressLine(state, true, columns).length <= columns, `fits ${columns} columns`)
  assert.match(progressLine(state, true, 70), / 7 s/)
  assert.equal(progressLine(state, true, 200, true).includes("\x1b[32m"), true)
})

test("progress is one plain line, with no bar, when the output is not a terminal", () => {
  const line = progressLine({ page: 1, total: 2, course: "9001", title: "Alpha", saved: 1, updated: 0, same: 0, empty: 0, failed: 0, elapsedMs: 1000, pauseLeft: null }, false)
  assert.equal(line.includes("█"), false)
  assert.equal(line.includes("\r"), false)
  assert.equal(line.includes("\x1b"), false)
  assert.match(line, /^page 1 of 2 \| 9001 \| Alpha \|/)
  assert.equal(estimateLeftMs({ page: 0, total: 2, elapsedMs: 0 }), null)
})

test("the final report says FINISHED only when every course is accounted for, and names what went wrong otherwise", () => {
  const good = { id: "9001", title: "Made-up course", result: result() }
  const done = finalReport({ courses: [good], stopped: null, page: 3, total: 3, elapsedMs: 65_000 }, false)
  assert.match(done, /✔ FINISHED: all 3 lessons checked in 1 course, 1 min 05 s/)
  assert.match(done, /✔ 9001\. Made-up course\n {6}3 lessons: 3 new, 0 updated, 0 unchanged/)
  const bad = finalReport({ courses: [{ ...good, result: result({ saved: 2, failed: ["Gamma"] }) }], stopped: null, page: 3, total: 3, elapsedMs: 1000 }, false)
  assert.match(bad, /✖ NOT FINISHED: 1 of 1 course incomplete/)
  assert.match(bad, /✖ failed: Gamma/)
  const stopped = finalReport({ courses: [], stopped: "stopped with Ctrl-C", page: 12, total: 78, elapsedMs: 1000 }, false)
  assert.match(stopped, /■ STOPPED at page 12 of 78: stopped with Ctrl-C/)
  assert.equal(stopped.includes("FINISHED"), false)
  assert.equal(finalReport({ courses: [good], stopped: null, page: 3, total: 3, elapsedMs: 1000 }, true).includes("\x1b[32m"), true)
  const updated = finalReport({ courses: [{ ...good, result: result({ saved: 3, textChanged: ["Alpha", "Beta"] }) }], stopped: null, page: 3, total: 3, elapsedMs: 1000 }, false)
  assert.match(updated, /3 lessons: 1 new, 2 updated, 0 unchanged/)
  // Nothing is wider than the terminal, so a line never wraps, and courses are separated by a blank line.
  for (const columns of [40, 60, 90]) for (const line of finalReport({ courses: [good, { ...good, id: "9002", title: "A very long made-up course title that would not fit", result: result({ saved: 2, failed: ["Gamma"] }) }], stopped: null, page: 3, total: 6, elapsedMs: 1000 }, false, columns).split("\n")) assert.ok(line.length <= columns, `fits ${columns}: ${line}`)
  assert.match(finalReport({ courses: [good, good], stopped: null, page: 3, total: 6, elapsedMs: 1000 }, false), /\n\n {2}✔ 9001\./)
})

test("the manifest is written outside the saved readings and holds no text", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "crawl-manifest-"))
  try {
    const file = manifestFile(root, "some-exam", "9001")
    assert.equal(file, path.join(root, "some-exam", "9001.manifest.json"))
    assert.equal(await readManifest(file), null)
    await writeManifest(file, manifest)
    assert.deepEqual(await readManifest(file), manifest)
    const raw = await readFile(file, "utf8")
    assert.equal(raw.includes("text"), false)
    assert.throws(() => manifestFile(root, "../x", "9001"))
    assert.throws(() => manifestFile(root, "some-exam", "9001/../x"))
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test("a manifest made under an older listing rule is not compared, so lessons the new rule lists are not blamed on Google", () => {
  const { listing: _listing, ...older } = manifest
  const now = [...lessons, { title: "A made-up video", href: "/course_templates/9001/video/444", kind: "video" as const }]
  assert.deepEqual(compareLessons(older, now), { first: true, added: [], removed: [], reordered: false, addressChanged: [] })
  assert.deepEqual(compareLessons({ ...older, listing: 1 }, now).added, [], "another listing version is not compared either")
  assert.deepEqual(compareLessons(manifest, now).added, ["A made-up video"], "under the same rule a new lesson is still reported")
})

test("a text written into a script block cannot end the block, and reads back the same", () => {
  const text = "a </script><img src=x onerror=alert(1)> & b\u2028c\u2029d"
  const written = jsonForScript(text)
  for (const character of ["<", ">", "&", "\u2028", "\u2029"]) assert.equal(written.includes(character), false, JSON.stringify(character))
  assert.equal(JSON.parse(written), text)
})

test("the served frame page of a settling lesson cannot be broken out of by its text", async (t) => {
  const site = await startFakeSite({ "9001": [{ title: "Settling", kind: "settle", text: "a </script><b>x</b> & b\u2028c" }] })
  t.after(() => site.close())
  // The first lesson of a fake site is numbered 1000.
  const html = await (await fetch(`${site.url}/frame/1000`)).text()
  assert.equal(html.split("</script>").length - 1, 1, "only the page's own script block ends")
  assert.equal(html.includes("\u2028"), false)
  assert.ok(html.includes("\\u003c/script\\u003e"), "the text is there, as escapes")
})

test("a path name that is an object property name is not a path, and a path page escapes what it writes into links", async (t) => {
  const site = await startFakeSite({}, { "4525": { title: "A made-up path", cards: [{ type: "course", title: "A made-up course", template: "9001" }] } })
  t.after(() => site.close())
  assert.equal((await fetch(`${site.url}/paths/constructor`)).status, 404)
  assert.equal((await fetch(`${site.url}/paths/4525`)).status, 200)
})
