import assert from "node:assert/strict"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { readFileSync } from "node:fs"
import test from "node:test"
import { loadPack } from "./pack.ts"
import { MAX_SPEAK_CHARS } from "./speak-limit.ts"
import { reviewStop } from "./reading-view.ts"
import { bundleUrl, htmlBlocks, htmlParagraphs, nextReading, pageList, readingIds, reading, reviewUrl, riseUrl, splitLong, type Bundle } from "./reading.ts"
import { testPack, testRoot } from "./test-pack.ts"

const COURSES = testPack.courses

// A made-up bundle in the shape of Google's course/en/*.json: page → article → block → component.
function bundle(): Bundle {
  return {
    contentObjects: [
      { _id: "p2", _type: "page", _sortOrder: 1, title: "C9_M1_L2 - Second" },
      { _id: "p1", _type: "page", _sortOrder: 0, title: "⭐ C9_M1_L1 - Internal name" },
      { _id: "off", _type: "page", _sortOrder: 2, _isEnabled: false, title: "Switched off" },
      { _id: "menu", _type: "menu", _sortOrder: 3 },
      { _id: "p3", _type: "page", _sortOrder: 4, title: "C9_M1_L3 - Only a review" },
    ],
    articles: [
      { _id: "a1", _parentId: "p1", _sortOrder: 0 },
      { _id: "a-off", _parentId: "p1", _sortOrder: 1, _isEnabled: false },
      { _id: "a2", _parentId: "p2", _sortOrder: 0 },
      { _id: "a3", _parentId: "p3", _sortOrder: 0 },
    ],
    blocks: [
      { _id: "b2", _parentId: "a1", _sortOrder: 1 },
      { _id: "b1", _parentId: "a1", _sortOrder: 0 },
      { _id: "b-off", _parentId: "a-off", _sortOrder: 0 },
      { _id: "b3", _parentId: "a2", _sortOrder: 0 },
      { _id: "b4", _parentId: "a3", _sortOrder: 0 },
    ],
    components: [
      { _id: "c1", _parentId: "b1", _component: "text", displayTitle: "Kinds of data", body: "<p>Data comes in two forms.</p><ul><li>Structured</li><li>Unstructured</li></ul>" },
      { _id: "c2", _parentId: "b2", _component: "accordion", displayTitle: "Kinds of data", instruction: "Select each button to learn more.", _items: [{ title: "Labelled", body: "<p>Has tags.</p>" }] },
      { _id: "c3", _parentId: "b2", _component: "graphic", title: "Graphic Title", _sortOrder: 1 },
      { _id: "c-off", _parentId: "b-off", _component: "text", displayTitle: "Hidden draft", body: "<p>Never read.</p>" },
      { _id: "c4a", _parentId: "b3", _sortOrder: -3, _component: "text", displayTitle: "Kinds of chart" },
      { _id: "c4b", _parentId: "b3", _sortOrder: 5, _component: "text", displayTitle: "Review&nbsp;" },
      { _id: "c4", _parentId: "b3", _sortOrder: 6, _component: "mcq", _isQuestionType: true, displayTitle: "Quiz yourself", body: "<p>A photo is?</p>", _items: [{ text: "Structured", _shouldBeSelected: false }, { text: "Unstructured", _shouldBeSelected: true }] },
      { _id: "c4c", _parentId: "b3", _sortOrder: 4, _component: "flipCard", displayTitle: "\u200bQuiz yourself: Kinds\u200b", _items: [{ frontText: "<p>Q</p>", backText: "<p>A</p>" }] },
      { _id: "c5", _parentId: "b3", _sortOrder: 1, _component: "table", _rows: [["Feature", "A", "B"], ["Speed", "fast", "slow"]] },
      { _id: "c6", _parentId: "b3", _sortOrder: 2, _component: "flipCard", _items: [{ frontText: "<p>Front</p>", backText: "<p>Back</p>" }] },
      { _id: "c8", _parentId: "b4", _component: "mcq", _isQuestionType: true, displayTitle: "Quiz yourself", _items: [] },
      { _id: "c7", _parentId: "b3", _sortOrder: 3, _component: "tabs", _items: [{ tabText: "Tab one", body: "<p>Tab body</p>" }] },
    ],
  }
}

test("HTML becomes plain paragraphs with entities decoded", () => {
  assert.deepEqual(htmlParagraphs("<p dir=\"ltr\">It&#39;s <strong>data</strong>&nbsp;&amp; more</p><p><br></p><p>Next&rsquo;s line<br>split</p>"), ["It's data & more", "Next’s line", "split"])
  assert.deepEqual(htmlParagraphs(undefined), [])
  assert.deepEqual(htmlParagraphs("<p><span>Gen</span>AI, <b>x</b>.</p>"), ["GenAI, x."])
  assert.deepEqual(htmlParagraphs("<p>Bad &#99999999; code</p>"), ["Bad &#99999999; code"])
  assert.deepEqual(htmlParagraphs("<p>Before<script>hidden</script>after<style>hidden</style>end</p>"), ["Before after end"])
})

test("noscript markup is extracted as text", () => {
  assert.deepEqual(htmlParagraphs("<p><noscript><strong>Fallback</strong></noscript></p>"), ["Fallback"])
})

test("HTML attributes containing greater-than signs do not leak into the reading", () => {
  assert.deepEqual(htmlParagraphs('<p title="a > b">Text <span title="c > d">inside</span></p>'), ["Text inside"])
})

test("HTML block tags with quoted greater-than signs retain headings, leads, and list items", () => {
  assert.deepEqual(htmlBlocks('<h3 title="a > b">Heading</h3><p title="a > b"><strong>Lead</strong> body</p><ul><li title="a > b">Item</li></ul>'), [
    { text: "Heading", heading: true },
    { text: "Lead body", lead: "Lead" },
    { items: ["Item"] },
  ])
})

test("bold leads inside multi-letter inline wrappers are retained", () => {
  assert.deepEqual(htmlBlocks("<p><span><strong>Half</strong> bold</p>"), [{ text: "Half bold", lead: "Half" }])
})

test("malformed nested script-like tags remain escaped text", () => {
  const paragraphs = [
    ...htmlParagraphs("<p><scr<script>x</script>ipt>alert(1)</p>"),
    ...htmlParagraphs("<p><<b>script></p>"),
  ]
  assert.deepEqual(paragraphs, ["x</script>ipt>alert(1)", "<script>"])
  const markup = paragraphs.map((paragraph) => renderToStaticMarkup(createElement("p", null, paragraph))).join("")
  assert.doesNotMatch(markup, /<\/?script\b/i)
})

test("a long paragraph is cut at a sentence end, never above the clip limit", () => {
  const text = `${"Word ".repeat(30).trim()}. ${"More ".repeat(30).trim()}.`
  const parts = splitLong(text, 200)
  assert.ok(parts.every((part) => part.length <= 200))
  assert.equal(parts[0]?.endsWith("."), true)
  assert.equal(parts.join(" "), text)
  assert.deepEqual(splitLong("Short.", 200), ["Short."])
})

test("pages come in course order, switched-off pages and menus left out, titled by their first heading", () => {
  assert.deepEqual(pageList(bundle()), [
    { id: "p1", title: "Kinds of data" },
    { id: "p2", title: "Kinds of chart" },
    { id: "p3", title: "Only a review" },
  ])
  assert.deepEqual(reading(bundle(), "p3"), { title: "Only a review", paragraphs: [], review: true, reviewAt: [0], videoAt: [] })
})

test("a page reads its shown components in order, without instructions, images or switched-off drafts", () => {
  assert.deepEqual(reading(bundle(), "p1"), {
    title: "Kinds of data",
    paragraphs: [
      { text: "Kinds of data", heading: true },
      { text: "Data comes in two forms.", heading: false },
      { text: "Structured", heading: false, bullet: true },
      { text: "Unstructured", heading: false, bullet: true },
      { text: "Kinds of data", heading: true },
      { text: "Labelled", heading: true },
      { text: "Has tags.", heading: false },
    ],
    review: false,
    reviewAt: [],
    videoAt: [],
  })
})

test("a video stops the voice after its own title and intro; one in a review's article is left out with it", () => {
  const youtube = (id: string) => ({ _service: "youtube", _media: { _source: `<iframe src="https://www.youtube.com/embed/${id}"></iframe>` } })
  const data: Bundle = {
    contentObjects: [{ _id: "p", _type: "page", title: "C9_M1_L1 - Videos" }],
    articles: [{ _id: "a", _parentId: "p" }, { _id: "r", _parentId: "p", _sortOrder: 1 }],
    blocks: [{ _id: "b", _parentId: "a" }, { _id: "rb", _parentId: "r" }],
    components: [
      { _id: "t", _parentId: "b", _component: "text", displayTitle: "Notebook in action", body: "<p>Take a look.</p><p><em>Select the play button to learn more.</em></p>" },
      { _id: "v1", _parentId: "b", _sortOrder: 1, _component: "videoStream", ...youtube("one") },
      { _id: "after", _parentId: "b", _sortOrder: 2, _component: "text", body: "<p>Your team can share it.</p>" },
      { _id: "v2", _parentId: "b", _sortOrder: 3, _component: "videoStream", displayTitle: "Introduction", body: "<p>Hear from the creators.</p>", ...youtube("two") },
      { _id: "v3", _parentId: "b", _sortOrder: 4, _component: "videoStream", ...youtube("three") },
      { _id: "end", _parentId: "b", _sortOrder: 5, _component: "text", body: "<p>Key takeaway.</p>" },
      { _id: "q", _parentId: "rb", _component: "mcq", _isQuestionType: true, displayTitle: "Quiz yourself", _items: [] },
      { _id: "v4", _parentId: "rb", _sortOrder: 1, _component: "videoStream", displayTitle: "Try it", ...youtube("four") },
    ],
  }
  const page = reading(data, "p")!
  assert.deepEqual(page.paragraphs.map((paragraph) => paragraph.text), ["Notebook in action", "Take a look.", "Your team can share it.", "Introduction", "Hear from the creators.", "Key takeaway."])
  assert.deepEqual(page.videoAt, [2, 5], "after each intro; two videos with nothing between share a stop; the review's own video is left out")
  assert.deepEqual(page.reviewAt, [6])
})

test("a review is left out, never its answers; tables, flip cards and tabs are read in full", () => {
  assert.equal(reading(bundle(), "p2")?.review, true)
  // The review closes the page: its button stays at the end, with no stop.
  assert.deepEqual(reading(bundle(), "p2")?.reviewAt, [6])
  assert.deepEqual(reading(bundle(), "p2")?.paragraphs, [
    { text: "Kinds of chart", heading: true },
    { text: "Speed. A: fast. B: slow", heading: false },
    { text: "Front", heading: false },
    { text: "Back", heading: false },
    { text: "Tab one", heading: true },
    { text: "Tab body", heading: false },
  ])
})

test("a block's own heading and intro are read before its components, its 'select… to learn more' lines left out", () => {
  const data: Bundle = {
    contentObjects: [{ _id: "p", _type: "page", title: "C9_M1_L1 - HITL" }],
    articles: [{ _id: "a", _parentId: "p", displayTitle: "Limits", body: "<p>Select the + buttons below to expand each section and learn more.</p>" }],
    blocks: [{ _id: "b", _parentId: "a", displayTitle: "Humans in the loop (HITL)", body: "<p><br></p><p>HITL adds human review.</p><p>Select the right model.</p><p><em>Select each button to expand the items and learn more.</em></p>" }],
    components: [
      { _id: "c", _parentId: "b", _component: "accordion", _items: [{ title: "Content moderation", body: "<p>HITL filters harm.</p>" }] },
      { _id: "r", _parentId: "revealed", _component: "text", body: "<p>Shown after a click.</p>" },
    ],
  }
  data.blocks.push({ _id: "revealed", _parentId: "a", _sortOrder: 1, _isHidden: true })
  assert.deepEqual(reading(data, "p")?.paragraphs, [
    { text: "Limits", heading: true },
    { text: "Humans in the loop (HITL)", heading: true },
    { text: "HITL adds human review.", heading: false },
    { text: "Select the right model.", heading: false },
    { text: "Content moderation", heading: true },
    { text: "HITL filters harm.", heading: false },
    { text: "Shown after a click.", heading: false },
  ])
})

test("a flip card's back or a tab's body that repeats its name reads the name once", () => {
  const data: Bundle = {
    contentObjects: [{ _id: "p", _type: "page", title: "C9_M1_L1 - Models" }],
    articles: [{ _id: "a", _parentId: "p" }],
    blocks: [{ _id: "b", _parentId: "a", displayTitle: "Review", body: "" }],
    components: [
      { _id: "c", _parentId: "b", _component: "flipCard", _items: [{ frontText: "<p><strong>Gemma</strong></p>", backText: "<p><span><strong>Gemma</strong></span>&nbsp;</p><p>Open models.</p>" }] },
      { _id: "t", _parentId: "b", _sortOrder: 1, _component: "tabs", _items: [{ tabText: "Start small", body: "<p><strong>Start small</strong></p><p><br></p><p>Use what exists.</p>" }] },
    ],
  }
  assert.deepEqual(reading(data, "p")?.paragraphs, [
    { text: "Gemma", heading: true },
    { text: "Open models.", heading: false },
    { text: "Start small", heading: true },
    { text: "Use what exists.", heading: false },
  ])
})

const twoPages = [{ id: "x", title: "First" }, { id: "y", title: "Last" }]

test("NEXT leads to the course's next reading", () => {
  assert.deepEqual(nextReading(COURSES[1]!, twoPages, "x", COURSES), { href: "/read/2/y", title: "Last" })
})

test("after a course's last reading, NEXT leads to the next course", () => {
  assert.deepEqual(nextReading(COURSES[1]!, twoPages, "y", COURSES), { href: "/read/3", title: `Course 3, ${COURSES[2]!.title}` })
})

test("after the last course, and from an unknown page, there is no NEXT", () => {
  assert.equal(nextReading(COURSES[COURSES.length - 1]!, twoPages, "y", COURSES), null)
  assert.equal(nextReading(COURSES[1]!, twoPages, "nope", COURSES), null)
})

test("an unknown or switched-off page has no reading", () => {
  assert.equal(reading(bundle(), "off"), null)
  assert.equal(reading(bundle(), "nope"), null)
})

test("bundle URLs point only at Google's public course bucket", () => {
  for (const course of COURSES) {
    assert.match(bundleUrl(course, "components"), /^https:\/\/storage\.googleapis\.com\/cloud-training\/cls-html5-courses\/GAIL-Chunked\/C\d_[^/]+\/course\/en\/components\.json$/)
  }
})

test("each reading links to its own page on Google Skills, or to the course when the counts differ", () => {
  const course = COURSES[1]
  const page = `x /course_templates/1265/html_bundles/652141 y /course_templates/1265/html_bundles/652142 /course_templates/1265/html_bundles/652141 /course_templates/1265/quizzes/652147`
  const ids = readingIds(page, course)
  assert.deepEqual(ids, ["652141", "652142"])
  assert.deepEqual(reviewUrl(course, ids, 2, 1), { url: "https://www.skills.google/paths/1951/course_templates/1265/html_bundles/652142", direct: true })
  assert.deepEqual(reviewUrl(course, ids, 3, 1), { url: "https://www.skills.google/paths/1951/course_templates/1265", direct: false })
})

test("reading navigation and source URLs follow the selected exam pack", () => {
  const courses = loadPack(testRoot, "agentic-architect").courses
  const first = courses[0]
  const rise = courses.find((course) => course.format === "rise")
  assert.ok(first)
  assert.ok(rise)
  assert.deepEqual(nextReading(first, twoPages, "y", courses), { href: "/read/2", title: "Course 2, Optimize Agent Behavior" })
  assert.deepEqual(reviewUrl(first, ["123"], 1, 0), { url: "https://www.skills.google/paths/4525/course_templates/1584/html_bundles/123", direct: true })
  assert.equal(bundleUrl(first, "components"), "https://storage.googleapis.com/cloud-training/cls-html5-courses/T-DEVAGENTMEM-B/2.0/course/en/components.json")
  assert.equal(riseUrl(rise), "https://storage.googleapis.com/cloud-training/cls-html5-courses/T-AGTOPS-I/v1.0.0/EN/runtime-data.js")
})

test("a short paragraph that is all bold, or an HTML heading, is a heading; bold inside text is not", () => {
  assert.deepEqual(
    htmlBlocks('<p><strong><span style="font-size: 22px;">Workflow agents</span></strong></p><p>Workflow agents are <strong>designed</strong>.</p><p><b>A whole bold sentence that ends.</b></p><h3>How it works</h3>'),
    [{ text: "Workflow agents", heading: true }, { text: "Workflow agents are designed." }, { text: "A whole bold sentence that ends." }, { text: "How it works", heading: true }],
  )
  assert.deepEqual(htmlBlocks('<p><span style="color: black;"><strong>Customer service agents</strong></span></p><p><strong>Half</strong> bold</p>'), [
    { text: "Customer service agents", heading: true },
    { text: "Half bold", lead: "Half" },
  ])
})

test("a bold start of a bullet or paragraph is kept, to be shown in bold", () => {
  assert.deepEqual(
    htmlBlocks('<ul><li><p><strong>Evaluate model capabilities</strong>: Look for benchmarks.</p></li><li>Plain item</li></ul><p><b>Casual conversation:</b> Feeling bored?</p><p>No bold here.</p>'),
    [
      { items: ["Evaluate model capabilities: Look for benchmarks.", "Plain item"], leads: ["Evaluate model capabilities", null] },
      { text: "Casual conversation: Feeling bored?", lead: "Casual conversation:" },
      { text: "No bold here." },
    ],
  )
})

test("the learning path's list of courses is left out; the course lists show it already", () => {
  const data: Bundle = {
    contentObjects: [{ _id: "p", _type: "page", title: "C9_M1_L1 - Intro" }],
    articles: [{ _id: "a", _parentId: "p" }],
    blocks: [{ _id: "b", _parentId: "a" }],
    components: [{
      _id: "c", _parentId: "b", _component: "narrative", displayTitle: "Learning path", body: "<p>This path prepares you for the exam.</p>",
      _items: [
        { title: "Gen AI: Beyond the Chatbot", body: "<p>Course 1</p>" },
        { title: "Gen AI Apps: Transform Your Work", body: "<p><strong>Course 4: You are here</strong></p>" },
        { title: "", body: "<p><strong>Gen AI Agents: Transform Your Organization</strong></p><p><br></p><p>Course 5: End of your journey</p>" },
        { title: "Prompting", body: "<p>Course 4 shows how to write prompts.</p>" },
      ],
    }],
  }
  assert.deepEqual(reading(data, "p")?.paragraphs, [
    { text: "Learning path", heading: true },
    { text: "This path prepares you for the exam.", heading: false },
    { text: "Prompting", heading: true },
    { text: "Course 4 shows how to write prompts.", heading: false },
  ])
})

test("a long paragraph cut in pieces keeps its bold start on the first piece", () => {
  const long = `${"Word ".repeat(80).trim()}. ${"More ".repeat(80).trim()}.`
  const data: Bundle = {
    contentObjects: [{ _id: "p", _type: "page", title: "C9_M1_L1 - Long" }],
    articles: [{ _id: "a", _parentId: "p" }],
    blocks: [{ _id: "b", _parentId: "a" }],
    components: [
      { _id: "c", _parentId: "b", _component: "text", body: `<p><strong>Key point:</strong> ${long}</p>` },
      { _id: "d", _parentId: "b", _sortOrder: 1, _component: "tabs", displayTitle: "Agents", _items: [{ tabText: "Agents", body: "<p>Course 3</p>" }] },
    ],
  }
  const paragraphs = reading(data, "p")?.paragraphs ?? []
  assert.equal(paragraphs[0]?.lead, "Key point:")
  assert.ok(paragraphs.length > 2 && paragraphs.slice(1).every((piece) => piece.lead === undefined || piece.heading))
  assert.ok(paragraphs.some((piece) => piece.text === "Course 3"), "outside a learning path, a Course line is kept")
})

test("two reviews in a row mark the first, and both are left out", () => {
  const data: Bundle = {
    contentObjects: [{ _id: "p", _type: "page", title: "C5_M1_L2 - Today's agents" }],
    articles: [
      { _id: "a", _parentId: "p" },
      { _id: "cards", _parentId: "p", _sortOrder: 1 },
      { _id: "rev", _parentId: "p", _sortOrder: 2 },
      { _id: "k", _parentId: "p", _sortOrder: 3 },
    ],
    blocks: [
      { _id: "b", _parentId: "a" },
      { _id: "cb", _parentId: "cards" },
      { _id: "rb", _parentId: "rev" },
      { _id: "qb", _parentId: "rev", _sortOrder: 1 },
      { _id: "kb", _parentId: "k" },
    ],
    components: [
      { _id: "intro", _parentId: "b", _component: "text", body: "<p>All due to the connections of the three components of an agent.</p>" },
      {
        _id: "flip",
        _parentId: "cb",
        _component: "flipCard",
        displayTitle: "Review the components of an agent",
        body: "<p>Let’s review the key components of an agent discussed in previous courses.</p>",
        instruction: "Select the cards below to learn more.",
        _items: [{ frontText: "<p><strong>Foundational model</strong></p>", backText: "<p>This is the underlying language model.</p>" }],
      },
      { _id: "r", _parentId: "rb", _component: "text", displayTitle: "Review" },
      { _id: "q", _parentId: "qb", _component: "cardDrop", _isQuestionType: true, displayTitle: "Quiz yourself: Order the agents", body: "<p>Order the agents.</p>", _items: [{ text: "Early" }] },
      { _id: "kt", _parentId: "kb", _component: "text", displayTitle: "Key takeaway", body: "<p>Agents use tools.</p>" },
    ],
  }
  const page = reading(data, "p")!
  assert.deepEqual(page.paragraphs.map((paragraph) => paragraph.text), [
    "All due to the connections of the three components of an agent.",
    "Key takeaway",
    "Agents use tools.",
  ])
  assert.equal(page.review, true)
  assert.deepEqual(page.reviewAt, [1], "the button is at the first review, before the key takeaway")
  assert.equal(reviewStop(page.review, page.reviewAt[0] ?? null, page.paragraphs.length), 1)
})

test("an experiment done on Google is left out, and the review button sits where it was", () => {
  const data: Bundle = {
    contentObjects: [{ _id: "p", _type: "page", title: "C5_M2_L3 - Parameter playground" }],
    articles: [{ _id: "a", _parentId: "p" }, { _id: "k", _parentId: "p", _sortOrder: 1 }],
    blocks: [{ _id: "b", _parentId: "a" }, { _id: "e", _parentId: "a", _sortOrder: 1 }, { _id: "kb", _parentId: "k" }],
    components: [
      { _id: "intro", _parentId: "b", _component: "text", body: "<p>Having learned about the parameters, try them.</p>" },
      {
        _id: "acc",
        _parentId: "e",
        _component: "accordion",
        body: "<p>The best way to understand these parameters is to try them yourself.</p>",
        _items: [
          { title: "<strong>Open Google AI Studio</strong>", body: "<p>Select Playground.</p>" },
          { title: "<strong>Experiment with temperature</strong>", body: "<p>Move the slider.</p>" },
        ],
      },
      { _id: "link", _parentId: "e", _sortOrder: 1, _component: "links", body: "<p>Open Google AI Studio</p>" },
      { _id: "kt", _parentId: "kb", _component: "text", displayTitle: "Key takeaway", body: "<p>Hands-on practice shows what the parameters do.</p>" },
    ],
  }
  const page = reading(data, "p")!
  assert.deepEqual(page.paragraphs.map((paragraph) => paragraph.text), [
    "Having learned about the parameters, try them.",
    "Key takeaway",
    "Hands-on practice shows what the parameters do.",
  ])
  assert.equal(page.review, true)
  assert.deepEqual(page.reviewAt, [1], "the button is where the experiment stood, before the key takeaway")
  assert.equal(reviewStop(page.review, page.reviewAt[0] ?? null, page.paragraphs.length), 1)
})

test("a Try it page is titled by that line when the only heading left is Key takeaway", () => {
  const data: Bundle = {
    contentObjects: [{ _id: "p", _type: "page", title: "C5_M3_L2: Enhancing the customer experience with agents" }],
    articles: [{ _id: "try", _parentId: "p" }, { _id: "k", _parentId: "p", _sortOrder: 1 }],
    blocks: [{ _id: "tb", _parentId: "try" }, { _id: "eb", _parentId: "try", _sortOrder: 1 }, { _id: "kb", _parentId: "k" }],
    components: [
      { _id: "t", _parentId: "tb", _component: "text", displayTitle: "Try it: RAG in action" },
      { _id: "acc", _parentId: "eb", _component: "accordion", _items: [{ title: "Open Google AI Studio", body: "<p>Select Playground.</p>" }] },
      { _id: "kt", _parentId: "kb", _component: "text", displayTitle: "Key takeaway", body: "<p>Hands-on experience with RAG.</p>" },
    ],
  }
  const page = reading(data, "p")!
  assert.equal(page.title, "Try it: RAG in action")
  assert.deepEqual(page.paragraphs.map((paragraph) => paragraph.text), ["Key takeaway", "Hands-on experience with RAG."])
  assert.deepEqual(page.reviewAt, [0])
  assert.deepEqual(pageList(data), [{ id: "p", title: "Try it: RAG in action" }])
})

test("a Start button pauses the voice before the conversation it starts", () => {
  const data: Bundle = {
    contentObjects: [{ _id: "p", _type: "page", title: "C5_M2_L5 - Prompt engineering techniques" }],
    articles: [{ _id: "a", _parentId: "p" }],
    blocks: [{ _id: "b", _parentId: "a" }, { _id: "d", _parentId: "a", _sortOrder: 1 }, { _id: "after", _parentId: "a", _sortOrder: 2 }],
    components: [
      { _id: "intro", _parentId: "b", _component: "text", displayTitle: "ReAct prompting", body: "<p>ReAct gives a model a brain and a pair of hands.</p>" },
      {
        _id: "play",
        _parentId: "d",
        _component: "dialog",
        instruction: "Select the Start button to learn more.",
        _people: [
          { _id: "think", name: "Think" },
          { _id: "act", name: "Act" },
          { _id: "observe", name: "Observe" },
          { _id: "respond", name: "Respond" },
        ],
        _items: [
          { _personId: "think", body: "<p>Okay, I need to find a restaurant.</p>" },
          { _personId: "act", body: "<p>I'll search online.</p>" },
          { _personId: "observe", body: "<p>Here are some options.</p>" },
          { _personId: "respond", body: "<p>I recommend this one.</p>" },
        ],
      },
      { _id: "next", _parentId: "after", _component: "text", body: "<p>This thought-action-observation loop lets the model gather information.</p>" },
      { _id: "quiz", _parentId: "rb", _component: "text", displayTitle: "Review" },
      { _id: "kt", _parentId: "kb", _component: "text", displayTitle: "Key takeaway", body: "<p>ReAct gathers information.</p>" },
    ],
  }
  data.articles.push({ _id: "rev", _parentId: "p", _sortOrder: 1 }, { _id: "k", _parentId: "p", _sortOrder: 2 })
  data.blocks.push({ _id: "rb", _parentId: "rev" }, { _id: "kb", _parentId: "k" })
  const page = reading(data, "p")!
  assert.deepEqual(page.paragraphs.map((paragraph) => paragraph.text), [
    "ReAct prompting",
    "ReAct gives a model a brain and a pair of hands.",
    "Think. Okay, I need to find a restaurant.",
    "Act. I'll search online.",
    "Observe. Here are some options.",
    "Respond. I recommend this one.",
    "This thought-action-observation loop lets the model gather information.",
    "Key takeaway",
    "ReAct gathers information.",
  ])
  assert.equal(page.review, true)
  assert.deepEqual(page.reviewAt, [2, 7], "Start pauses before the cards, and the Review below keeps its own stop")
})

test("dialog card names are inserted literally into paragraph and list bodies", () => {
  const data: Bundle = {
    contentObjects: [{ _id: "p", _type: "page", title: "C1 - Dialog" }],
    articles: [{ _id: "a", _parentId: "p" }],
    blocks: [{ _id: "b", _parentId: "a" }],
    components: [{
      _id: "dialog", _parentId: "b", _component: "dialog",
      _people: [{ _id: "dollar", name: "$&" }, { _id: "list", name: "List" }],
      _items: [{ _personId: "dollar", body: "<p>Text.</p>" }, { _personId: "list", body: "<ul><li>Item.</li></ul>" }],
    }],
  }
  assert.deepEqual(reading(data, "p")?.paragraphs.map((paragraph) => paragraph.text), ["$&. Text.", "List. Item."])
})

test("client-facing reading modules do not import the server parser module", () => {
  for (const file of ["../components/read-aloud.tsx", "../components/progress-client.tsx", "../components/reading-progress.tsx", "./score.ts"]) {
    const source = readFileSync(new URL(file, import.meta.url), "utf8")
    assert.doesNotMatch(source, /from ["'](?:@\/lib\/reading|\.\/reading\.ts)["']/)
  }
})

test("the voice stops before a review in the middle of a page, never at its start or end", () => {
  assert.equal(reviewStop(true, 31, 34), 31)
  assert.equal(reviewStop(true, 0, 34), null, "a review before any text: the button stays at the end")
  assert.equal(reviewStop(true, 34, 34), null, "a review after all the text: no stop")
  assert.equal(reviewStop(false, null, 34), null)
  const p2 = reading(bundle(), "p2")!
  assert.equal(reviewStop(p2.review, p2.reviewAt[0] ?? null, p2.paragraphs.length), null)
})

test("a line or bullet that is only a link out is left out", () => {
  assert.deepEqual(
    htmlBlocks('<p>Build with our APIs.</p><ul><li><p><a href="https://x">View Vision specs ↗</a>&nbsp;</p></li><li>Gemma, <a href="https://y">open</a> models</li></ul><p><a href="https://z">Generate an API key ↗</a></p>'),
    [{ text: "Build with our APIs." }, { items: ["Gemma, open models"] }],
  )
  assert.deepEqual(htmlBlocks('<ul><li><a href="https://x">View A specs ↗</a></li></ul>'), [], "a list of links only is left out whole")
  assert.deepEqual(htmlBlocks('<ul><li>Gemini Pro, Flash, and more. <a href="https://x">View Gemini specs ↗</a></li></ul>'), [{ items: ["Gemini Pro, Flash, and more."] }])
})

test("a list becomes one block of its items", () => {
  assert.deepEqual(htmlBlocks("<p>Fields like:</p><ul><li><p>Customer ID</p></li><li>Order <b>cost</b></li></ul><p>After.</p>"), [
    { text: "Fields like:" },
    { items: ["Customer ID", "Order cost"] },
    { text: "After." },
  ])
})

test("each bullet of a list is a paragraph of its own, with its bold start; a review after it stops at the right one", () => {
  const data: Bundle = {
    contentObjects: [{ _id: "p", _type: "page", title: "C9_M1_L1 - Lists" }],
    articles: [{ _id: "a", _parentId: "p" }, { _id: "k", _parentId: "p", _sortOrder: 1 }],
    blocks: [{ _id: "b", _parentId: "a" }, { _id: "kb", _parentId: "k" }],
    components: [
      { _id: "c", _parentId: "b", _component: "text", body: "<p>Look for:</p><ul><li><strong>Benchmarks</strong>: how it scores.</li><li>Plain item</li></ul>" },
      { _id: "q", _parentId: "b", _sortOrder: 1, _component: "mcq", _isQuestionType: true, displayTitle: "Quiz yourself", _items: [] },
      { _id: "kt", _parentId: "kb", _component: "text", body: "<p>Key takeaway.</p>" },
    ],
  }
  const page = reading(data, "p")!
  assert.deepEqual(page.paragraphs, [
    { text: "Look for:", heading: false },
    { text: "Benchmarks: how it scores.", heading: false, lead: "Benchmarks", bullet: true },
    { text: "Plain item", heading: false, bullet: true },
    { text: "Key takeaway.", heading: false },
  ])
  assert.deepEqual(page.reviewAt, [3], "the stop is before the key takeaway, after the last bullet")
})

test("a bullet too long for one clip keeps its bullet on its first piece only", () => {
  const long = `${"Word ".repeat(300).trim()}. ${"More ".repeat(300).trim()}.`
  const data: Bundle = {
    contentObjects: [{ _id: "p", _type: "page", title: "C9_M1_L1 - Long bullet" }],
    articles: [{ _id: "a", _parentId: "p" }],
    blocks: [{ _id: "b", _parentId: "a" }],
    components: [{ _id: "c", _parentId: "b", _component: "text", body: `<ul><li>${long}</li></ul>` }],
  }
  const paragraphs = reading(data, "p")?.paragraphs ?? []
  assert.ok(paragraphs.length > 1 && paragraphs.every((piece) => piece.text.length <= MAX_SPEAK_CHARS))
  assert.deepEqual(paragraphs.map((piece) => piece.bullet === true), [true, ...paragraphs.slice(1).map(() => false)])
  assert.equal(paragraphs.map((piece) => piece.text).join(" "), long)
})

test("one clip's limit is the speak routes' own, and cuts keep emoji whole", () => {
  assert.equal(splitLong("x".repeat(MAX_SPEAK_CHARS)).length, 1)
  assert.equal(splitLong("x".repeat(MAX_SPEAK_CHARS + 1)).length, 2)
  const emoji = "😀".repeat(150)
  const parts = splitLong(emoji, 101)
  assert.equal(parts.join(""), emoji)
  assert.ok(parts.every((part) => !/[\ud800-\udbff]$/.test(part)), "no piece ends on half an emoji")
  assert.deepEqual(splitLong("😀😀", 1), ["😀", "😀"], "a limit of one still moves on")
})

test("NUL and lone surrogate halves are never decoded, and nothing is decoded twice", () => {
  assert.deepEqual(htmlParagraphs("<p>a&#0;b &#xD800;c &amp;lt;d</p>"), ["a&#0;b &#xD800;c &lt;d"])
})

test("a nested list keeps all its text, in order", () => {
  const blocks = htmlBlocks("<ul><li>Outer<ul><li>inner</li></ul></li><li>Last</li></ul>")
  const text = blocks.map((block) => ("text" in block ? block.text : block.items.join(" "))).join(" ")
  assert.equal(text, "Outer inner Last")
})

test("a video and a review at the same place are one button that opens the video", () => {
  const source = readFileSync(new URL("../components/read-aloud.tsx", import.meta.url), "utf8")
  assert.match(source, /const bothButton = video && review && \(\s*<ActionLink[^>]*href=\{video\.url\}/)
  assert.match(source, /"WATCH VIDEO AND DO REVIEW"/)
  assert.match(source, /reviewStops\.includes\(index\) && videoStops\.includes\(index\)\s*\?\s*bothButton/)
  assert.match(source, /reviewAtEnd && reviewButton && videoAtEnd \? bothButton/)
  assert.doesNotMatch(source, /Review and video/)
})
