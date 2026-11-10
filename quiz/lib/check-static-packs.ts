import { readFileSync, readdirSync } from "node:fs"
import path from "node:path"
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

// The captured parts by their first MIN_CHECKED_CHARS characters (every part is at least that long), so a source file is
// scanned once whatever the number of captured lines: each position is looked up, and only a match on the start is confirmed.
export function indexParts(parts: string[]): Map<string, string[]> {
  const index = new Map<string, string[]>()
  for (const part of parts) {
    const start = part.slice(0, MIN_CHECKED_CHARS)
    index.set(start, [...(index.get(start) ?? []), part])
  }
  return index
}

function findsAny(variant: string, index: Map<string, string[]>): boolean {
  for (let at = 0; at + MIN_CHECKED_CHARS <= variant.length; at += 1) {
    const candidates = index.get(variant.slice(at, at + MIN_CHECKED_CHARS))
    if (candidates?.some((part) => variant.startsWith(part, at))) return true
  }
  return false
}

// What a source file leaks, if anything: the store's own path or captured text. The file is read, normalised and parsed once.
export function leakIn(file: string, storePath: string, captured: Map<string, string[]>): "path" | "text" | null {
  const variants = variantsOf(file)
  if (variants.some((variant) => variant.includes(storePath))) return "path"
  if (captured.size > 0 && variants.some((variant) => findsAny(variant, captured))) return "text"
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

  for (const { id } of listPacks(root)) loadPack(root, id)
  const records = await allPrivateReadings()
  const files = ["exams", "quiz", "pages-static"].flatMap((folder) => filesUnder(path.join(root, folder)))
  const storePath = normalizeText(privateReadingRoot())
  const captured = indexParts([...new Set(records.flatMap((record) => checkedParts(record.text)))])
  for (const file of files) {
    const leak = leakIn(file, storePath, captured)
    if (leak === "path") throw new Error("Static build sources contain the private reading store path.")
    if (leak === "text") throw new Error("Static build sources contain text from the private reading store.")
  }
}

const root = path.resolve(process.argv[2] ?? "..")
checkStaticPacks(root).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "unknown error"
  process.stderr.write(`Static pack check failed: ${message}\n`)
  process.exitCode = 1
})
