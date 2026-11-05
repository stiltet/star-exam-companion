import type { Bundle } from "./reading.ts"

// Google publishes some courses in a second format (Articulate Rise): one file, runtime-data.js,
// that holds the whole course as base64 JSON. This turns such a course into the bundle shape the
// reader already handles (pages, articles, blocks, components), so pages, paragraphs, review stops and the voice
// work the same for both. A lesson is a page, a Rise block is a block, and what it holds is one component.
type Node = Record<string, unknown>

const MARKER = /__jsonp\("runtime-data\.js","([^"]+)"/

// The course inside runtime-data.js. Google's own bucket is the only source, but the file is still checked.
export function decodeRise(file: string): unknown {
  const found = MARKER.exec(file)
  if (!found?.[1]) throw new Error("runtime-data.js is not a Rise course")
  return JSON.parse(Buffer.from(found[1], "base64").toString("utf8"))
}

function text(value: unknown): string {
  return typeof value === "string" ? value : ""
}

function list(value: unknown): Node[] {
  return Array.isArray(value) ? (value as Node[]) : []
}

// A list item's line without Rise's wrapper div and paragraph tags, keeping bold and italics.
function inner(html: unknown): string {
  return text(html)
    .replace(/<\/?(div|p)\b[^>]*>/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
}

// Text Rise puts in a block that was never filled in: the tool's own placeholder.
const PLACEHOLDER = /^(heading|subheading|paragraph)$/i
function filled(html: unknown): string {
  return PLACEHOLDER.test(inner(html)) ? "" : text(html)
}

const VIDEO = /youtube|youtu\.be|vimeo|\.mp4|video/i

// What one Rise block says, as components in reading order. Transcripts are left unread: the video they
// belong to is played on Google, as for every other course. Images and code carry no reading text.
function components(block: Node): Node[] {
  const variant = text(block.variant)
  const items = list(block.items)
  switch (block.type) {
    case "text":
    case "image":
      return items.map((item) => ({ _component: "text", displayTitle: filled(item.heading), body: `${filled(item.subheading)}${filled(item.paragraph)}` }))
    case "list": {
      const tag = variant === "numbered" ? "ol" : "ul"
      return [{ _component: "text", body: `<${tag}>${items.map((item) => `<li>${inner(item.paragraph)}</li>`).join("")}</${tag}>` }]
    }
    case "interactive": {
      if (/^flashcard|^stack/.test(variant)) {
        return [{ _component: "flipCard", _items: items.map((item) => ({ frontText: text((item.front as Node | undefined)?.description), backText: text((item.back as Node | undefined)?.description) })) }]
      }
      // Tabs, accordions, processes, timelines and labelled graphics: a title and a body each.
      const shown = items.filter((item) => !/^transcript$/i.test(inner(item.title)))
      return [{ _component: "accordion", _items: shown.map((item) => ({ title: text(item.title), body: text(item.description) })) }]
    }
    case "knowledgeCheck":
      // A question is left for Google's page, as in the other format: the voice stops at it.
      return [{ _component: "questions", _isQuestionType: true }]
    case "multimedia": {
      const source = items.map((item) => JSON.stringify((item.media as Node | undefined)?.embed ?? (item.media as Node | undefined)?.video ?? "")).join(" ")
      return VIDEO.test(source) ? [{ _component: "videoStream" }] : []
    }
    default:
      return []
  }
}

// The reader's four lists for one Rise course. Section dividers have no content and are dropped.
export function riseBundle(data: unknown): Bundle {
  const course = (data as { course?: { lessons?: unknown } } | null)?.course
  const lessons = list(course?.lessons).filter((lesson) => lesson.type === "blocks")
  if (!course || lessons.length === 0) throw new Error("The Rise course has no lessons")
  const bundle: Bundle = { contentObjects: [], articles: [], blocks: [], components: [] }
  lessons.forEach((lesson, lessonIndex) => {
    const page = text(lesson.id)
    const article = `${page}-article`
    bundle.contentObjects.push({ _id: page, _type: "page", _sortOrder: lessonIndex, title: text(lesson.title) })
    bundle.articles.push({ _id: article, _parentId: page, _sortOrder: 0 })
    list(lesson.items).forEach((block, blockIndex) => {
      const id = text(block.id) || `${page}-block-${blockIndex}`
      bundle.blocks.push({ _id: id, _parentId: article, _sortOrder: blockIndex })
      components(block).forEach((component, index) => {
        bundle.components.push({ ...component, _id: `${id}-${index}`, _parentId: id, _sortOrder: index })
      })
    })
  })
  return bundle
}
