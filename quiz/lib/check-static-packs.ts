import { readFileSync, readdirSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { allPrivateReadings, assertPrivateReadingOutsideRepo, privateReadingRoot } from "./private-reading.ts"
import { listPacks, loadPack } from "./pack.ts"

function normalizeText(text: string): string {
  return text.replace(/\s+/g, " ").trim()
}

function stringsIn(value: unknown): string[] {
  if (typeof value === "string") return [value]
  if (Array.isArray(value)) return value.flatMap(stringsIn)
  if (value && typeof value === "object") return Object.values(value).flatMap(stringsIn)
  return []
}

// A source file as the text it can say: its content, the content with spaces collapsed, and each string inside its JSON.
function variantsOf(file: string): string[] {
  const content = readFileSync(file, "utf8")
  const variants = [content, normalizeText(content)]
  if (file.endsWith(".json")) variants.push(...stringsIn(JSON.parse(content)).map(normalizeText))
  return variants
}

// Only the local files that never reach a build are skipped, by their exact names: a tracked source file whose
// name merely starts with "scores" or ".env" is still checked.
const LOCAL_ONLY = [/^node_modules$/, /^\.next[\w.-]*$/, /^scores(?:-[a-z0-9-]+)?\.jsonl$/, /^scores-backups$/, /^\.env(?:\.(?:local|development|production|test))*$/, /^active-exam\.json$/]
// What is compared of a capture: its whole text if that is at least this many characters, and each of its lines that is. A few
// words such as "Continue" would match ordinary interface text and block the build, so a capture whose whole text and every
// line are shorter than this is not compared, which the README says.
export const MIN_CHECKED_CHARS = 40

// What to look for in the sources for one capture: its whole text and each of its long enough lines, normalised once.
export function checkedParts(text: string): string[] {
  const parts = [normalizeText(text), ...text.split(/\r?\n/).map(normalizeText)]
  return [...new Set(parts.filter((part) => part.length >= MIN_CHECKED_CHARS))]
}

// The captured parts, with an index by their first MIN_CHECKED_CHARS characters (every part is at least that long) for a store
// with many of them: a source file is then scanned once whatever the number of captured lines, each position looked up and only
// a match on the start confirmed. For a few parts the native search is faster, so the index is used only from INDEX_FROM parts up.
export const INDEX_FROM = 50

export type Captured = { parts: string[]; index: Map<string, string[]> | null }

export function indexParts(parts: string[]): Captured {
  if (parts.length < INDEX_FROM) return { parts, index: null }
  const index = new Map<string, string[]>()
  for (const part of parts) {
    const start = part.slice(0, MIN_CHECKED_CHARS)
    index.set(start, [...(index.get(start) ?? []), part])
  }
  return { parts, index }
}

function findsAny(variant: string, captured: Captured): boolean {
  const { parts, index } = captured
  if (index === null) return parts.some((part) => variant.includes(part))
  for (let at = 0; at + MIN_CHECKED_CHARS <= variant.length; at += 1) {
    const candidates = index.get(variant.slice(at, at + MIN_CHECKED_CHARS))
    if (candidates?.some((part) => variant.startsWith(part, at))) return true
  }
  return false
}

// What a source file leaks, if anything: the store's own path or captured text. The file is read, normalised and parsed once.
export function leakIn(file: string, storePath: string, captured: Captured): "path" | "text" | null {
  const variants = variantsOf(file)
  if (variants.some((variant) => variant.includes(storePath))) return "path"
  if (captured.parts.length > 0 && variants.some((variant) => findsAny(variant, captured))) return "text"
  return null
}

function filesUnder(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (LOCAL_ONLY.some((pattern) => pattern.test(entry.name))) return []
    const file = path.join(directory, entry.name)
    if (entry.isSymbolicLink()) throw new Error("Static build sources must not contain linked files.")
    return entry.isDirectory() ? filesUnder(file) : [file]
  })
}

async function checkStaticPacks(root: string): Promise<void> {
  process.env.QUIZ_ROOT = root
  await assertPrivateReadingOutsideRepo(root)

  // What the packs themselves say in public (a course's title, why one has no text): a captured page repeats its course's title
  // as a line, which is no leak, since the title is written in the pack.
  const publicText = normalizeText(listPacks(root).flatMap(({ id }) => {
    const pack = loadPack(root, id)
    // The exam's own official addresses are public too: a captured lesson can repeat a link to the exam guide on its own line.
    const addresses = [pack.meta.examPage, pack.meta.examGuide, pack.meta.learningPath, ...(pack.meta.links ?? []).map((link) => link.href)]
    return [...addresses.filter((address): address is string => typeof address === "string"), ...pack.courses.map((course) => course.title), ...pack.noReading.flatMap((course) => [course.title, course.why])]
  }).join("\n"))
  const records = await allPrivateReadings()
  const files = ["exams", "quiz", "pages-static"].flatMap((folder) => filesUnder(path.join(root, folder)))
  const storePath = normalizeText(privateReadingRoot())
  const captured = indexParts([...new Set(records.flatMap((record) => checkedParts(record.text)))].filter((part) => !publicText.includes(part)))
  for (const file of files) {
    const leak = leakIn(file, storePath, captured)
    if (leak === "path") throw new Error("Static build sources contain the private reading store path.")
    if (leak === "text") throw new Error("Static build sources contain text from the private reading store.")
  }
}

// Run as a script it checks the tree; imported (by a test) it only offers its functions.
if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(process.argv[2] ?? "..")
  checkStaticPacks(root).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "unknown error"
    process.stderr.write(`Static pack check failed: ${message}\n`)
    process.exitCode = 1
  })
}
