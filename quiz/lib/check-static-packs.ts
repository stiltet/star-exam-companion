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

function filesUnder(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === "node_modules" || entry.name.startsWith(".next") || entry.name.startsWith("scores") ||
      entry.name.startsWith(".env") || entry.name === "active-exam.json") return []
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
      if (fileContainsText(file, record.text)) {
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
