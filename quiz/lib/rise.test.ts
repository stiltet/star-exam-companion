import assert from "node:assert/strict"
import test from "node:test"
import { pageList, reading } from "./reading.ts"
import { decodeRise, riseBundle } from "./rise.ts"

// A small Rise course in the shape Google publishes, one of each block that carries reading text.
const para = (text: string) => `<div data-editor-id="x"><p>${text}</p></div>`
const course = {
  course: {
    lessons: [
      { id: "s1", type: "section", title: "A divider", items: [] },
      {
        id: "l1",
        type: "blocks",
        title: "The lifecycle",
        items: [
          { id: "b1", type: "text", variant: "heading paragraph", items: [{ heading: para("<strong>The lifecycle</strong>"), paragraph: para("An agent moves from build to run.") }] },
          { id: "b2", type: "text", variant: "heading", items: [{ heading: para("Heading") }] },
          { id: "b3", type: "list", variant: "bulleted", items: [{ paragraph: para("<strong>Build:</strong> write the agent.") }, { paragraph: para("<strong>Run:</strong> operate it.") }] },
          { id: "b4", type: "interactive", variant: "accordion", items: [{ title: "Why it matters", description: para("Quality drifts without care.") }, { title: "Transcript", description: para("Brett: a long spoken transcript.") }] },
          { id: "b5", type: "interactive", variant: "flashcard", items: [{ front: { description: para("Drift") }, back: { description: para("Behaviour changes over time.") } }] },
          { id: "b6", type: "multimedia", variant: "embed", items: [{ media: { embed: { src: '<iframe src="https://www.youtube.com/embed/abc"></iframe>' } } }] },
          { id: "b7", type: "knowledgeCheck", variant: "multiple choice", items: [{ title: para("Which is right?") }] },
          { id: "b8", type: "image", variant: "hero", items: [{ paragraph: "" }] },
        ],
      },
      { id: "l2", type: "blocks", title: "Only a picture", items: [{ id: "c1", type: "image", variant: "hero", items: [{ paragraph: "" }] }] },
    ],
  },
}

test("a Rise runtime-data.js file is decoded from its base64 JSON", () => {
  const file = `__jsonp("runtime-data.js","${Buffer.from(JSON.stringify(course)).toString("base64")}")`
  assert.deepEqual(decodeRise(file), course)
  assert.throws(() => decodeRise("not a course"), /not a Rise course/)
})

test("a Rise course becomes pages the reader lists, one per lesson with something to read", () => {
  const bundle = riseBundle(course)
  assert.deepEqual(bundle.contentObjects.map((node) => node._id), ["l1", "l2"], "the divider is dropped")
  assert.deepEqual(pageList(bundle), [{ id: "l1", title: "The lifecycle" }], "a lesson with only a picture is not a reading")
})

test("a Rise reading keeps its text in order and leaves quizzes, videos and transcripts to Google", () => {
  const found = reading(riseBundle(course), "l1")!
  const spoken = found.paragraphs.map((paragraph) => `${paragraph.heading ? "# " : ""}${paragraph.bullet ? "- " : ""}${paragraph.text}`)
  assert.deepEqual(spoken.slice(0, 6), ["# The lifecycle", "An agent moves from build to run.", "- Build: write the agent.", "- Run: operate it.", "# Why it matters", "Quality drifts without care."])
  assert.ok(!spoken.some((line) => /Heading$/.test(line) || /transcript/i.test(line)), "the placeholder heading and the transcript are not read")
  assert.ok(spoken.includes("Drift") && spoken.includes("Behaviour changes over time."), "a flash card's two sides are read")
  assert.equal(found.review, true, "the question is a review stop")
  assert.equal(found.videoAt.length, 1, "the video is a stop")
})

test("a Rise course with no lessons is refused", () => {
  assert.throws(() => riseBundle({ course: { lessons: [{ id: "s", type: "section", items: [] }] } }), /no lessons/)
  assert.throws(() => riseBundle(null), /no lessons/)
})
