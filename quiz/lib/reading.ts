// The official course text, read aloud on /read. Google's learning path shows each reading in
// a frame from a public Cloud Storage bundle; the bundle's course/en/*.json files hold the
// text, as pages → articles → blocks → components. Nothing is copied into this repo: the
// server reads the bundle when a page is asked for.

import { parseFragment, type DefaultTreeAdapterMap } from "parse5"
import type { Course, PageSummary, Paragraph, Reading } from "./reading-view.ts"
import { MAX_SPEAK_CHARS } from "./speak-limit.ts"

export const PARTS = ["contentObjects", "articles", "blocks", "components"] as const

// The course's public page on Google Skills, which lists its readings in order.
export function coursePageUrl(course: Course): string {
  return `https://www.skills.google/course_templates/${course.template}`
}

// The reading pages' ids on Google Skills, in the order the course page lists them.
export function readingIds(coursePage: string, course: Course): string[] {
  const found = coursePage.matchAll(new RegExp(`/course_templates/${course.template}/html_bundles/(\\d+)`, "g"))
  return [...new Set([...found].map((match) => match[1] ?? ""))].filter(Boolean)
}

// Where the owner does a reading's review, so Google ticks it off: the reading itself when
// the course page lists as many readings as the bundle has pages, else the course.
// direct says which one it is, so the button can say when it only reaches the course.
export function reviewUrl(course: Course, ids: string[], pageCount: number, pageIndex: number): { url: string; direct: boolean } {
  const id = ids.length === pageCount ? ids[pageIndex] : undefined
  return id
    ? { url: `${course.path}/course_templates/${course.template}/html_bundles/${id}`, direct: true }
    : { url: `${course.path}/course_templates/${course.template}`, direct: false }
}

// A Rise course's one file; its folder already names the language, so the path ends there.
export function riseUrl(course: Course): string {
  return `${course.bundleBase}/${bundleFolder(course)}/runtime-data.js`
}

export function bundleUrl(course: Course, part: (typeof PARTS)[number]): string {
  return `${course.bundleBase}/${bundleFolder(course)}/course/en/${part}.json`
}

function bundleFolder(course: Course): string {
  if (!course.folder) throw new Error(`Course ${course.id} has no public bundle folder.`)
  return course.folder.split("/").map(encodeURIComponent).join("/")
}

// The longest text one clip may carry: the speak routes' own limit.
const MAX_PART = MAX_SPEAK_CHARS

type Node = Record<string, unknown> & { _id?: string; _parentId?: string; _sortOrder?: number; _type?: string; _isEnabled?: boolean; _isHidden?: boolean }

export type Bundle = Record<(typeof PARTS)[number], Node[]>

// One paragraph to read: a heading or body text, each short enough for one clip.
// review: the page had a "Quiz yourself" review, a Start button, or another hands-on stop, left
// for Google. reviewAt: each paragraph such a stop stood before. A page can have many. The voice
// pauses at each, and each has its own button. videoAt: for each video, the paragraph after its
// title and intro, where it stood. Its link goes there and the voice stops, as for a review.
const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", ndash: "–", mdash: "—", hellip: "…" }

function decode(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, name: string) => {
    if (name[0] === "#") {
      const code = name[1]?.toLowerCase() === "x" ? Number.parseInt(name.slice(2), 16) : Number.parseInt(name.slice(1), 10)
      // NUL and lone surrogate halves are left as written: neither is a character `say` can read.
      const usable = Number.isInteger(code) && code > 0 && code <= 0x10ffff && (code < 0xd800 || code > 0xdfff)
      return usable ? String.fromCodePoint(code) : whole
    }
    return ENTITIES[name.toLowerCase()] ?? whole
  })
}

// The paragraphs of an HTML fragment as plain text: block ends and <br> break paragraphs.
export function htmlParagraphs(input: unknown): string[] {
  if (typeof input !== "string") return []
  // Keep the existing entity rules while letting the parser discard ignored markup.
  const fragment = parseFragment(input.replaceAll("&", "&amp;"), { scriptingEnabled: false })
  const paragraphs: string[] = []
  const blockTags = new Set(["p", "div", "li", "h1", "h2", "h3", "h4", "h5", "h6", "tr", "ul", "ol", "blockquote"])
  let paragraph = ""
  const breakParagraph = () => {
    paragraphs.push(paragraph)
    paragraph = ""
  }
  function visit(node: DefaultTreeAdapterMap["childNode"]): void {
    if (node.nodeName === "#text" && "value" in node) {
      paragraph += decode(node.value)
      return
    }
    const tag = "tagName" in node ? node.tagName : undefined
    if (tag === "script" || tag === "style") {
      paragraph += " "
      return
    }
    if (tag === "br") {
      breakParagraph()
      return
    }
    const block = tag !== undefined && blockTags.has(tag)
    if (block) breakParagraph()
    if ("childNodes" in node) {
      for (const child of node.childNodes) visit(child)
    }
    if (block) breakParagraph()
  }
  for (const child of fragment.childNodes) visit(child)
  paragraphs.push(paragraph)
  return paragraphs
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line.length > 0)
}

function paragraphsFor(html: string, cache: Map<string, string[]>): string[] {
  const found = cache.get(html)
  if (found) return found
  const paragraphs = htmlParagraphs(html)
  cache.set(html, paragraphs)
  return paragraphs
}

const TAG_ATTRIBUTES = String.raw`(?:[^>"']|"[^"]*"|'[^']*')*`
const HEADING_TAG = new RegExp(String.raw`<(h[1-6])\b${TAG_ATTRIBUTES}>([\s\S]*?)<\/\1>`, "gi")
const PARAGRAPH_TAG = new RegExp(String.raw`<p\b${TAG_ATTRIBUTES}>([\s\S]*?)<\/p>`, "gi")
const BOLD_TAG = new RegExp(String.raw`<(strong|b)\b${TAG_ATTRIBUTES}>[\s\S]*?<\/\1>`, "gi")
const LEAD_START = new RegExp(String.raw`^\s*(?:<(?!(?:strong|b)\b)[a-z][a-z0-9]*\b${TAG_ATTRIBUTES}>\s*)*<(strong|b)\b${TAG_ATTRIBUTES}>([\s\S]*?)<\/\1>`, "i")
const LINK_OUT = new RegExp(String.raw`<a\b${TAG_ATTRIBUTES}>(?:(?!<\/a>)[\s\S])*↗(?:(?!<\/a>)[\s\S])*<\/a>`, "gi")
const LIST_CHUNK = new RegExp(String.raw`(<(?:ul|ol)\b${TAG_ATTRIBUTES}>[\s\S]*?<\/(?:ul|ol)>)`, "i")
const LIST_START = new RegExp(String.raw`^<(?:ul|ol)\b`, "i")
const LIST_ITEM = new RegExp(String.raw`<li\b${TAG_ATTRIBUTES}>([\s\S]*?)<\/li>`, "gi")
const PARAGRAPH_START = new RegExp(String.raw`^<p\b`, "i")
const PARAGRAPH_OPEN = new RegExp(String.raw`^(<p\b${TAG_ATTRIBUTES}>)`, "i")
const LIST_ITEM_OPEN = new RegExp(String.raw`^(<(?:ul|ol)\b${TAG_ATTRIBUTES}>\s*<li\b${TAG_ATTRIBUTES}>)`, "i")

function headingsIn(html: string, cache: Map<string, string[]>): Set<string> {
  const found = new Set<string>()
  for (const match of html.matchAll(HEADING_TAG)) found.add(paragraphsFor(match[2] ?? "", cache).join(" "))
  for (const match of html.matchAll(PARAGRAPH_TAG)) {
    const inner = match[1] ?? ""
    // All its text is bold, whatever spans wrap it: nothing is left once the bold parts go.
    const outsideBold = paragraphsFor(inner.replace(BOLD_TAG, ""), cache).join("")
    const text = paragraphsFor(inner, cache).join(" ")
    if (/<(strong|b)\b/i.test(inner) && outsideBold === "" && text.length <= 80 && !/[.?!]$/.test(text)) found.add(text)
  }
  return found
}

// The bold words a bullet or paragraph starts with, such as "Evaluate model capabilities" in
// "Evaluate model capabilities: Look for…", shown bold as on Google (owner, 20 Oct). Null when it
// starts plain, or when all of it is bold (that is a heading).
function leadOf(html: string, cache: Map<string, string[]>): string | null {
  const match = html.match(LEAD_START)
  if (!match) return null
  const lead = paragraphsFor(match[2] ?? "", cache).join(" ").trim()
  const all = paragraphsFor(html, cache).join(" ")
  return lead && all.startsWith(lead) && all.length > lead.length ? lead : null
}

function leadsIn(html: string, cache: Map<string, string[]>): Map<string, string> {
  const found = new Map<string, string>()
  for (const match of html.matchAll(PARAGRAPH_TAG)) {
    const inner = match[1] ?? ""
    const lead = leadOf(inner, cache)
    if (lead) found.set(paragraphsFor(inner, cache).join(" "), lead)
  }
  return found
}

export type Block = { text: string; heading?: true; lead?: string } | { items: string[]; leads?: (string | null)[] }

// The blocks of an HTML fragment: each <ul>/<ol> becomes one list of its items, the rest
// plain paragraphs as htmlParagraphs gives them. A nested list may split the box, but no text is lost.
export function htmlBlocks(html: unknown): Block[] {
  if (typeof html !== "string") return []
  const out: Block[] = []
  const paragraphCache = new Map<string, string[]>()
  // Google marks a link out with ↗, such as "View Vision specs ↗": the owner found these
  // annoying read aloud (20 Oct). The link goes; a line or bullet that was only the link goes with
  // it, and in "Gemini Pro, Flash, and more. View Gemini specs ↗" the sentence stays.
  const text = html.replace(LINK_OUT, "")
  for (const chunk of text.split(LIST_CHUNK)) {
    if (LIST_START.test(chunk)) {
      const found = [...chunk.matchAll(LIST_ITEM)]
        .map((match) => {
          const item = match[1] ?? ""
          return { text: paragraphsFor(item, paragraphCache).join(" "), lead: leadOf(item, paragraphCache) }
        })
        .filter((item) => item.text)
      const items = found.map((item) => item.text)
      if (items.length > 0) out.push(found.some((item) => item.lead) ? { items, leads: found.map((item) => item.lead) } : { items })
    } else {
      const headings = headingsIn(chunk, paragraphCache)
      const leads = leadsIn(chunk, paragraphCache)
      for (const text of paragraphsFor(chunk, paragraphCache)) {
        const lead = leads.get(text)
        out.push(headings.has(text) ? { text, heading: true } : lead ? { text, lead } : { text })
      }
    }
  }
  return out
}

// A paragraph longer than one clip, cut at sentence ends (or, failing that, at spaces).
export function splitLong(text: string, max = MAX_PART): string[] {
  if (text.length <= max) return [text]
  const parts: string[] = []
  let rest = text
  while (rest.length > max) {
    const window = rest.slice(0, max)
    const sentence = Math.max(window.lastIndexOf(". "), window.lastIndexOf("? "), window.lastIndexOf("! "))
    let cut = sentence > max / 2 ? sentence + 1 : window.lastIndexOf(" ") > 0 ? window.lastIndexOf(" ") : max
    // A hard cut never splits an emoji or other character made of two UTF-16 halves.
    if (cut === max && /[\ud800-\udbff]/.test(rest[cut - 1] ?? "")) cut -= 1
    // Never an empty piece: with max 1 a surrogate pair is taken whole, so the loop always moves on.
    if (cut < 1) cut = Math.min(2, rest.length)
    parts.push(rest.slice(0, cut).trim())
    rest = rest.slice(cut).trim()
  }
  if (rest) parts.push(rest)
  return parts
}

// Switched-off drafts are left out. _isHidden is not: Google marks text it reveals after a click
// that way, such as the closing paragraphs of "Secure AI" under its flowchart.
function shown(node: Node): boolean {
  return node._isEnabled !== false
}

function childrenOf(nodes: Node[], parent: string): Node[] {
  return nodes.filter((node) => node._parentId === parent && shown(node)).sort((a, b) => (a._sortOrder ?? 0) - (b._sortOrder ?? 0))
}

function items(component: Node): Node[] {
  return Array.isArray(component._items) ? (component._items as Node[]) : []
}

function plain(html: unknown): string {
  return htmlParagraphs(html).join(" ").replace(/[\u200b\s]+/g, " ").trim()
}

// A review: a question, a "Quiz yourself" card, a section whose title starts with "Review",
// or a hands-on experiment the owner does on Google (owner, 21 Oct). That includes a bare
// "Review" heading and "Review the components of an agent". A body or cards do not keep it
// readable. Nothing inside is read out; the owner does it on Google's page, which ticks the
// reading off. When two follow one another, both are left out and the button sits at the first.
function isReview(component: Node): boolean {
  if (component._isQuestionType === true) return true
  const title = plain(component.displayTitle)
  if (/^quiz yourself\b/i.test(title) || /^review\b/i.test(title)) return true
  return isExperiment(component)
}

// An experiment done on Google, such as Parameter playground: a "Try it" (not a video), or an
// accordion of steps ("Open Google AI Studio", "Experiment with temperature"). Same button as a review.
function isExperiment(component: Node): boolean {
  if (component._component === "videoStream" || component._component === "media") return false
  if (/^try it\b/i.test(plain(component.displayTitle))) return true
  if (component._component !== "accordion") return false
  return items(component).some((item) => /^(open google ai studio|craft a |experiment with|observe and analyze|run a prompt|get grounded|update the model)\b/i.test(plain(item.title)))
}

// A line telling the reader what to press, such as "Select each button to expand the items and
// learn more.": Google puts these in block bodies as well as in components' own instruction field.
function isInstruction(text: string): boolean {
  return /^(select|click|tap)\b.*\blearn more\b[.!]?$/i.test(text)
}

// A card's lines, with its name on the first one: "Think. Okay, I need to find…".
function namedCard(name: string, html: string): string {
  const safe = name.replace(/&/g, "&amp;").replace(/</g, "&lt;")
  const trimmed = html.trim()
  if (PARAGRAPH_START.test(trimmed)) return trimmed.replace(PARAGRAPH_OPEN, (_match, open: string) => `${open}${safe}. `)
  if (LIST_START.test(trimmed)) return trimmed.replace(LIST_ITEM_OPEN, (open) => `${open}${safe}. `)
  return `<p>${safe}. ${trimmed}</p>`
}

// What a component, or a block or article with text of its own, says, in reading order.
// Instructions ("Select each button…") are for the screen, so they are left out; so are images.
function componentText(component: Node): Paragraph[] {
  const out: Paragraph[] = []
  const heading = (html: unknown) => {
    const text = htmlParagraphs(html).join(" ")
    if (text) out.push({ text, heading: true })
  }
  const body = (html: unknown) => {
    for (const block of htmlBlocks(html)) {
      if ("text" in block) {
        // A card's back or a tab's body often repeats its name as its first line: "Gemma", then
        // what Gemma is. The name is read once.
        if (!isInstruction(block.text) && out[out.length - 1]?.text !== block.text) {
          out.push(block.lead ? { text: block.text, heading: false, lead: block.lead } : { text: block.text, heading: block.heading === true })
        }
      }
      // Each item of a list is a paragraph of its own, with the pause after it that any
      // paragraph has.
      else {
        block.items.forEach((item, index) => {
          const lead = block.leads?.[index]
          out.push(lead ? { text: item, heading: false, lead, bullet: true } : { text: item, heading: false, bullet: true })
        })
      }
    }
  }
  heading(component.displayTitle)
  body(component.body)
  switch (component._component) {
    case "graphic":
      break
    case "flipCard":
      for (const item of items(component)) {
        body(item.frontText)
        body(item.backText)
      }
      break
    case "dialog": {
      // The cards a Start button plays, such as Think, Act, Observe and Respond (owner, 21 Oct).
      // Each card's lines are read, under that card's name. The Start button itself is not text.
      const people = Array.isArray(component._people) ? (component._people as Node[]) : []
      for (const item of items(component)) {
        const name = plain(people.find((person) => person._id === item._personId)?.name)
        const html = typeof item.body === "string" ? item.body : ""
        body(name ? namedCard(name, html) : item.body)
      }
      break
    }
    case "table": {
      const rows = Array.isArray(component._rows) ? (component._rows as unknown[][]) : []
      const header = (rows[0] ?? []).map((cell) => htmlParagraphs(cell).join(" "))
      for (const row of rows.slice(1)) {
        const cells = row.map((cell) => htmlParagraphs(cell).join(" "))
        const named = cells.slice(1).map((cell, index) => (header[index + 1] ? `${header[index + 1]}: ${cell}` : cell))
        out.push({ text: [cells[0], ...named].filter(Boolean).join(". "), heading: false })
      }
      break
    }
    default:
      for (const item of items(component)) {
        // The learning path's list of courses ("Gen AI: Beyond the Chatbot", "Course 1", …,
        // "Course 4: You are here") in each course's first reading: the course lists show it.
        const lines = htmlParagraphs(item.body ?? item.text)
        const path = /learning path/i.test(htmlParagraphs(component.displayTitle).join(" "))
        if (path && lines.length <= 2 && /^course \d+(: [^.]{1,30})?\.?$/i.test(lines[lines.length - 1] ?? "")) continue
        heading(item.title ?? item.tabText)
        body(item.body ?? item.text)
      }
  }
  return out
}

function pages(bundle: Bundle): Node[] {
  return bundle.contentObjects.filter((node) => node._type === "page" && shown(node)).sort((a, b) => (a._sortOrder ?? 0) - (b._sortOrder ?? 0))
}

function pageParagraphs(bundle: Bundle, page: Node): { paragraphs: Paragraph[]; review: boolean; reviewAt: number[]; videoAt: number[]; tryTitle: string } {
  const out: Paragraph[] = []
  const reviewAt: number[] = []
  const videoAt: number[] = []
  // A Try it section is left unread. Its title still names the reading when the only heading left is Key takeaway.
  let tryTitle = ""
  // Two stops with nothing read between them share one button, as two videos do.
  const markReview = () => {
    if (reviewAt.at(-1) !== out.length) reviewAt.push(out.length)
  }
  const add = (paragraphs: Paragraph[]) => {
    for (const paragraph of paragraphs) {
      const previous = out[out.length - 1]
      // A heading repeated straight after itself, as a component under a block of the same name, is read once.
      if (previous && previous.heading && paragraph.heading && previous.text === paragraph.text) continue
      // A long paragraph cut in pieces keeps its bold start, and its bullet, on the first piece only.
      splitLong(paragraph.text).forEach((text, index) => {
        const piece: Paragraph = { text, heading: paragraph.heading }
        if (index === 0 && paragraph.lead && text.startsWith(paragraph.lead)) piece.lead = paragraph.lead
        if (index === 0 && paragraph.bullet) piece.bullet = true
        out.push(piece)
      })
    }
  }
  // Articles and blocks can carry a heading and an intro of their own, read before what they hold:
  // "Humans in the loop (HITL)" and what HITL is sit on a block, its examples in an accordion.
  // A section titled "Review" or "Review …", including flip cards with a body, is left out with
  // the quiz. Two such sections in a row both go; the button is at the first.
  const own = (node: Node) => {
    const text: Node = { displayTitle: node.displayTitle, body: node.body }
    if (!isReview(text)) add(componentText(text))
  }
  for (const article of childrenOf(bundle.articles, page._id ?? "")) {
    own(article)
    let inReview = false
    for (const block of childrenOf(bundle.blocks, article._id ?? "")) {
      if (!inReview) own(block)
      for (const component of childrenOf(bundle.components, block._id ?? "")) {
        if (isReview(component)) {
          const title = plain(component.displayTitle)
          if (!tryTitle && /^try it\b/i.test(title)) tryTitle = title
          markReview()
          inReview = true
          continue
        }
        // One Start button (owner, 21 Oct). The button sits before the conversation it starts, so
        // the voice pauses there, then Play reads the cards. A later Review keeps its own stop.
        if (component._component === "dialog" && !inReview) {
          markReview()
          add(componentText(component))
          continue
        }
        // The rest of that article is part of the same exercise on Google, such as its steps and
        // the link that opens the tool. Teaching text in a later article is still read.
        if (inReview) continue
        add(componentText(component))
        // Google's readings embed every video as a videoStream; two in a row with no text
        // between share one stop.
        if (component._component === "videoStream" && videoAt.at(-1) !== out.length) videoAt.push(out.length)
      }
    }
  }
  return { paragraphs: out, review: reviewAt.length > 0, reviewAt, videoAt, tryTitle }
}

// A page's title: its first heading, else its internal name without the "C2_M1_L4 - " code.
// "Key takeaway" names a section, not the reading. A Try it title that was left unread does.
function pageTitle(page: Node, paragraphs: Paragraph[], tryTitle: string): string {
  const first = paragraphs.find((paragraph) => paragraph.heading)?.text
  if (tryTitle && (!first || /^key takeaway$/i.test(first))) return tryTitle
  if (first) return first
  const name = typeof page.title === "string" ? page.title : ""
  return name.replace(/^[^A-Za-z]*C\d+_M\d+_L\d+\s*-\s*/, "").trim() || "Untitled"
}

export function pageList(bundle: Bundle): PageSummary[] {
  return pages(bundle)
    .map((page) => ({ page, ...pageParagraphs(bundle, page) }))
    // A page that is only a review stays, so the list still lines up with Google's readings.
    .filter(({ paragraphs, review }) => paragraphs.length > 0 || review)
    .map(({ page, paragraphs, tryTitle }) => ({ id: page._id ?? "", title: pageTitle(page, paragraphs, tryTitle) }))
}

export function reading(bundle: Bundle, pageId: string): Reading | null {
  const page = pages(bundle).find((node) => node._id === pageId)
  if (!page) return null
  const { paragraphs, review, reviewAt, videoAt, tryTitle } = pageParagraphs(bundle, page)
  return paragraphs.length > 0 || review ? { title: pageTitle(page, paragraphs, tryTitle), paragraphs, review, reviewAt, videoAt } : null
}

// Where NEXT leads: the course's next reading, or after its last one the next course's list of
// readings, so a course read through carries on into the next. None after the last course.
export function nextReading(course: Course, pages: PageSummary[], pageId: string, courses: readonly { id: string; title: string }[]): { href: string; title: string } | null {
  const at = pages.findIndex((page) => page.id === pageId)
  const page = at >= 0 ? pages[at + 1] : undefined
  if (page) return { href: `/read/${course.id}/${page.id}`, title: page.title }
  const index = courses.findIndex((entry) => entry.id === course.id)
  const following = index >= 0 ? courses[index + 1] : undefined
  return at >= 0 && following ? { href: `/read/${following.id}`, title: `Course ${following.id}, ${following.title}` } : null
}

// Where PREVIOUS leads: the course's previous lesson, or from its first lesson the course's own
// list of lessons. Nothing for a lesson the course does not have.
export function previousLesson(course: Course, pages: PageSummary[], pageId: string): { href: string; title: string } | null {
  const at = pages.findIndex((page) => page.id === pageId)
  if (at < 0) return null
  const page = pages[at - 1]
  return page ? { href: `/read/${course.id}/${page.id}`, title: page.title } : { href: `/read/${course.id}`, title: `Course ${course.id}, ${course.title}` }
}

// The course before and after this one, in the order /read lists them (courses with text, then
// the ones without). The ends have none.
export function courseNeighbours(courses: readonly { id: string; title: string }[], id: string): { previous: { href: string; title: string } | null; next: { href: string; title: string } | null } {
  const at = courses.findIndex((course) => course.id === id)
  const link = (course: { id: string; title: string } | undefined) => (course ? { href: `/read/${course.id}`, title: `Course ${course.id}, ${course.title}` } : null)
  return at < 0 ? { previous: null, next: null } : { previous: link(courses[at - 1]), next: link(courses[at + 1]) }
}

export function courseById(courses: readonly Course[], id: string): Course | undefined {
  return courses.find((course) => course.id === id)
}
