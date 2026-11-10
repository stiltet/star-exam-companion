import { readFileSync, readdirSync } from "node:fs"
import path from "node:path"
import { allPrivateReadings, assertPrivateReadingOutsideRepo, privateReadingRoot } from "./private-reading.ts"
import { listPacks, loadPack } from "./pack.ts"

function normalizeText(text: string): string {
  return text.replace(/\s+/g, " ").trim()
}

function containsText(value: unknown, target: string): boolean {
  if (typeof value === "string") {
    return value.includes(target) || normalizeText(value).includes(normalizeText(target))
  }
  if (Array.isArray(value)) return value.some((entry) => containsText(entry, target))
  if (value && typeof value === "object") return Object.values(value).some((entry) => containsText(entry, target))
  return false
}

function fileContainsText(file: string, target: string): boolean {
  const content = readFileSync(file, "utf8")
  if (content.includes(target) || normalizeText(content).includes(normalizeText(target))) return true
  if (!file.endsWith(".json")) return false
  return containsText(JSON.parse(content), target)
}

// Only the local files that never reach a build are skipped, by their exact names: a tracked source file whose
// name merely starts with "scores" or ".env" is still checked.
const LOCAL_ONLY = [/^node_modules$/, /^\.next[\w.-]*$/, /^scores(?:-[a-z0-9-]+)?\.jsonl$/, /^scores-backups$/, /^\.env(?:\.(?:local|development|production|test))*$/, /^active-exam\.json$/]
// A capture shorter than this is not compared: a few words such as "Continue" would match ordinary interface text and
// block the build, and nothing of value can be recognised in them.
export const MIN_CHECKED_CHARS = 80

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
  for (const file of files) {
    if (fileContainsText(file, privateReadingRoot())) {
      throw new Error("Static build sources contain the private reading store path.")
    }
    for (const record of records) {
      if (normalizeText(record.text).length >= MIN_CHECKED_CHARS && fileContainsText(file, record.text)) {
        throw new Error("Static build sources contain text from the private reading store.")
      }
    }
  }
}

const root = path.resolve(process.argv[2] ?? "..")
checkStaticPacks(root).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "unknown error"
  process.stderr.write(`Static pack check failed: ${message}\n`)
  process.exitCode = 1
})
