import assert from "node:assert/strict"
import test, { afterEach } from "node:test"
import { pageList, reading } from "./reading.ts"
import { courseBundle } from "./reading-provider.ts"
import { clearCourseCache } from "./course-text.ts"
import { loadPack } from "./pack.ts"
import { testRoot } from "./test-pack.ts"

const realFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = realFetch
  clearCourseCache()
})

test("the Google provider keeps the synthetic reading output of the public pack", async () => {
  const data = {
    contentObjects: [{ _id: "p", _type: "page", _sortOrder: 0, title: "Synthetic page" }],
    articles: [{ _id: "a", _parentId: "p", _sortOrder: 0 }],
    blocks: [{ _id: "b", _parentId: "a", _sortOrder: 0 }],
    components: [{ _id: "c", _parentId: "b", _sortOrder: 0, _component: "text", displayTitle: "Synthetic heading", body: "<p>Synthetic sentence.</p>" }],
  }
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(input)
    if (/\/course_templates\/\d+$/.test(url)) return new Response("")
    const part = url.split("/").at(-1)?.replace(/\.json$/, "") as keyof typeof data
    return Response.json(data[part])
  }) as typeof fetch

  const results = []
  // The Agentic Architect pack has no public course any more: all its courses are captured from Google Skills by the crawl.
  for (const id of ["generative-ai-leader"]) {
    const course = loadPack(testRoot, id).courses.find((entry) => entry.format !== "rise")
    assert.ok(course, `${id} has a bundle-backed course`)
    clearCourseCache()
    const loaded = await courseBundle(course)
    assert.equal(loaded.ok, true)
    if (!loaded.ok) continue
    results.push({ pages: pageList(loaded.bundle), reading: reading(loaded.bundle, "p") })
  }

  assert.deepEqual(results, [
    {
      pages: [{ id: "p", title: "Synthetic heading" }],
      reading: {
        title: "Synthetic heading",
        paragraphs: [{ text: "Synthetic heading", heading: true }, { text: "Synthetic sentence.", heading: false }],
        review: false,
        reviewAt: [],
        videoAt: [],
      },
    },
  ])
})

test("a private video lesson is its title and a video stop, and no transcript", async (t) => {
  const { mkdtemp, rm } = await import("node:fs/promises")
  const { tmpdir } = await import("node:os")
  const path = await import("node:path")
  const { savePrivateReading, privateReadingRoot } = await import("./private-reading.ts")
  const { manifestFile, writeManifest } = await import("./reading-crawl.ts")
  const base = await mkdtemp(path.join(tmpdir(), "video-provider-"))
  const before = process.env.QUIZ_PRIVATE_DIR
  process.env.QUIZ_PRIVATE_DIR = path.join(base, "private")
  t.after(async () => {
    if (before === undefined) delete process.env.QUIZ_PRIVATE_DIR
    else process.env.QUIZ_PRIVATE_DIR = before
    await rm(base, { recursive: true, force: true })
  })
  await savePrivateReading("video-test", "1", { pageId: "11", title: "A made-up reading", text: "A made-up reading sentence that is long enough to count." })
  await savePrivateReading("video-test", "1", { pageId: "22", title: "A made-up video", text: "A made-up video" })
  await writeManifest(manifestFile(privateReadingRoot(), "video-test", "1"), {
    checkedAt: "2026-01-01T00:00:00.000Z",
    lessons: [
      { title: "A made-up reading", href: "/course_templates/9/html_bundles/11", pageId: "11", hash: "x" },
      { title: "A made-up video", href: "/course_templates/9/video/22", pageId: "22", kind: "video", hash: "y" },
    ],
  })
  const course = { ...loadPack(testRoot, "agentic-architect").courses[0]!, id: "1", packId: "video-test", provider: "private" as const }
  const loaded = await courseBundle(course)
  assert.equal(loaded.ok, true)
  if (!loaded.ok) return
  assert.deepEqual(reading(loaded.bundle, "11")?.videoAt, [], "a reading has no video stop")
  const video = reading(loaded.bundle, "22")
  assert.deepEqual(video?.paragraphs.map((paragraph) => paragraph.text), ["A made-up video"], "a video reads only its title")
  assert.deepEqual(video?.videoAt, [1], "the video stop comes after the title")
})
