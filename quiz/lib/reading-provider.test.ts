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

test("the Google provider preserves the same synthetic reading output for both packs", async () => {
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
  for (const id of ["generative-ai-leader", "agentic-architect"]) {
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
