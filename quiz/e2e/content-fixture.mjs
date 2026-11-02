// Synthetic course text keeps browser tests independent of Google's availability and copyright. It answers for every
// exam pack's course bundles, since the exam can be switched while the tests run.
const bundle = {
  contentObjects: [
    { _id: "e2e-first", _type: "page", _sortOrder: 1, title: "Test reading one" },
    { _id: "e2e-second", _type: "page", _sortOrder: 2, title: "Test reading two" },
  ],
  articles: [
    { _id: "article-one", _parentId: "e2e-first", _sortOrder: 1 },
    { _id: "article-two", _parentId: "e2e-second", _sortOrder: 1 },
  ],
  blocks: [
    { _id: "block-one", _parentId: "article-one", _sortOrder: 1 },
    { _id: "block-two", _parentId: "article-two", _sortOrder: 1 },
  ],
  components: [
    { _id: "text-one", _parentId: "block-one", _sortOrder: 1, _component: "text", body: "<p>This is original test text about checking a reading page.</p>" },
    { _id: "text-two", _parentId: "block-two", _sortOrder: 1, _component: "text", body: "<p>This is the second original test paragraph.</p>" },
  ],
}
const originalFetch = globalThis.fetch
globalThis.fetch = async (input, init) => {
  const url = new URL(input instanceof Request ? input.url : input.toString())
  if (url.hostname === "storage.googleapis.com" && url.pathname.includes("/cls-html5-courses/")) {
    const part = url.pathname.split("/").at(-1)?.replace(".json", "")
    if (!Object.hasOwn(bundle, part)) throw new Error(`Unknown test bundle request: ${url}`)
    return Response.json(bundle[part])
  }
  if (url.hostname === "www.skills.google") return new Response("<html></html>")
  return originalFetch(input, init)
}
