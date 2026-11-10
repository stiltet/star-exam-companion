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

// Whether a source file holds any of the parts, as plain text or as a string inside its JSON. The file is read, normalised and
// parsed once, however many captures are checked.
function fileContains(file: string, parts: string[]): boolean {
  const content = readFileSync(file, "utf8")
  const normalised = normalizeText(content)
  const strings = file.endsWith(".json") ? stringsIn(JSON.parse(content)).map(normalizeText) : []
  return parts.some((part) => content.includes(part) || normalised.includes(part) || strings.some((value) => value.includes(part)))
}

// Only the local files that never reach a build are skipped, by their exact names: a tracked source file whose
// name merely starts with "scores" or ".env" is still checked.
const LOCAL_ONLY = [/^node_modules$/, /^\.next[\w.-]*$/, /^scores(?:-[a-z0-9-]+)?\.jsonl$/, /^scores-backups$/, /^\.env(?:\.(?:local|development|production|test))*$/, /^active-exam\.json$/]
// A line of a capture shorter than this is not compared: a few words such as "Continue" would match ordinary interface text
// and block the build. The whole text and each line of it are compared, so a capture is checked as soon as it holds one
// line this long; a capture made only of shorter lines is not checked, which the README says.
export const MIN_CHECKED_CHARS = 40

// What to look for in the sources for one capture: its whole text and each of its long enough lines, normalised once.
export function checkedParts(text: string): string[] {
  const parts = [normalizeText(text), ...text.split(/\r?\n/).map(normalizeText)]
  return [...new Set(parts.filter((part) => part.length >= MIN_CHECKED_CHARS))]
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
  const storePath = [normalizeText(privateReadingRoot())]
  const captured = [...new Set(records.flatMap((record) => checkedParts(record.text)))]
  for (const file of files) {
    if (fileContains(file, storePath)) throw new Error("Static build sources contain the private reading store path.")
    if (captured.length > 0 && fileContains(file, captured)) throw new Error("Static build sources contain text from the private reading store.")
  }
}

const root = path.resolve(process.argv[2] ?? "..")
checkStaticPacks(root).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "unknown error"
  process.stderr.write(`Static pack check failed: ${message}\n`)
  process.exitCode = 1
})
