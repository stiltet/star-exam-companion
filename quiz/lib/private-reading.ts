import { createHash, randomUUID } from "node:crypto"
import type { Dirent } from "node:fs"
import { chmod, mkdir, readFile, readdir, realpath, rename, rm, stat, writeFile } from "node:fs/promises"
import { homedir } from "node:os"
import path from "node:path"
import { repoRoot } from "./pack.ts"

const PACK_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const COURSE_ID = /^\d+$/
const PAGE_ID = /^\d+$/
const MAX_TITLE_CHARS = 500
const MAX_TEXT_CHARS = 1_000_000
const MAX_RECORD_BYTES = 4_000_000

export type PrivateReadingRecord = {
  pageId: string
  title: string
  text: string
  savedAt: string
}

export type PrivateReadingInput = Pick<PrivateReadingRecord, "pageId" | "title" | "text">

export function isPrivateReadingInput(value: unknown): value is PrivateReadingInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const input = value as Partial<PrivateReadingInput>
  if (
    typeof input.pageId !== "string" ||
    !PAGE_ID.test(input.pageId) ||
    typeof input.title !== "string" ||
    input.title.trim().length === 0 ||
    input.title.length > MAX_TITLE_CHARS ||
    typeof input.text !== "string" ||
    input.text.trim().length === 0 ||
    input.text.length > MAX_TEXT_CHARS
  ) return false
  const record = JSON.stringify({
    pageId: input.pageId,
    title: input.title.trim(),
    text: input.text.trim(),
    savedAt: "2000-01-01T00:00:00.000Z",
  })
  return new TextEncoder().encode(record).byteLength <= MAX_RECORD_BYTES
}

function isWithin(parent: string, candidate: string): boolean {
  const relative = path.relative(parent, candidate)
  return relative === "" || (relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative))
}

async function physicalPath(candidate: string): Promise<string> {
  let current = candidate
  const rest: string[] = []
  while (true) {
    try {
      return path.join(await realpath(current), ...rest)
    } catch (error) {
      if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") throw error
      const parent = path.dirname(current)
      if (parent === current) throw error
      rest.unshift(path.basename(current))
      current = parent
    }
  }
}

function configuredRoot(): string {
  const configured = process.env.QUIZ_PRIVATE_DIR
  if (configured !== undefined && !path.isAbsolute(configured)) {
    throw new Error("QUIZ_PRIVATE_DIR must be an absolute path.")
  }
  if (configured) return path.resolve(configured)
  const base = process.platform === "darwin"
    ? path.join(homedir(), "Library", "Application Support")
    : process.platform === "win32"
      ? process.env.APPDATA || path.join(homedir(), "AppData", "Roaming")
      : process.env.XDG_DATA_HOME || path.join(homedir(), ".local", "share")
  if (!path.isAbsolute(base)) throw new Error("The operating-system data directory must be an absolute path.")
  return path.join(base, "star-exam-companion", "private-reading")
}

async function checkedRoot(): Promise<string> {
  const root = configuredRoot()
  const [physicalRoot, physicalRepo] = await Promise.all([physicalPath(root), realpath(repoRoot())])
  if (isWithin(physicalRepo, physicalRoot)) {
    throw new Error("Private readings must be stored outside the repository.")
  }
  return root
}

function courseDirectory(root: string, packId: string, courseId: string): string {
  if (!PACK_ID.test(packId)) throw new Error("The private reading pack id is invalid.")
  if (!COURSE_ID.test(courseId)) throw new Error("The private reading course id is invalid.")
  return path.join(root, packId, courseId)
}

function recordFile(directory: string, pageId: string): string {
  if (!PAGE_ID.test(pageId)) throw new Error("The private reading page id is invalid.")
  const key = createHash("sha256").update(pageId).digest("hex")
  return path.join(directory, `${key}.json`)
}

function parseRecord(value: unknown, file: string): PrivateReadingRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Private reading record ${path.basename(file)} is invalid.`)
  }
  const record = value as Partial<PrivateReadingRecord>
  if (
    typeof record.pageId !== "string" ||
    !PAGE_ID.test(record.pageId) ||
    typeof record.title !== "string" ||
    record.title.length === 0 ||
    record.title.length > MAX_TITLE_CHARS ||
    typeof record.text !== "string" ||
    record.text.trim().length === 0 ||
    record.text.length > MAX_TEXT_CHARS ||
    typeof record.savedAt !== "string" ||
    !Number.isFinite(Date.parse(record.savedAt)) ||
    path.basename(file) !== `${createHash("sha256").update(record.pageId).digest("hex")}.json`
  ) {
    throw new Error(`Private reading record ${path.basename(file)} is invalid.`)
  }
  return record as PrivateReadingRecord
}

export async function readPrivateReadings(packId: string, courseId: string): Promise<PrivateReadingRecord[]> {
  const root = await checkedRoot()
  const directory = courseDirectory(root, packId, courseId)
  let entries: Dirent[]
  try {
    entries = await readdir(directory, { withFileTypes: true })
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return []
    throw error
  }
  const [physicalDirectory, physicalRoot] = await Promise.all([realpath(directory), physicalPath(root)])
  if (!isWithin(physicalRoot, physicalDirectory)) {
    throw new Error("The private reading directory points outside QUIZ_PRIVATE_DIR.")
  }
  const files = entries.filter((entry) => entry.isFile() && entry.name.endsWith(".json")).map((entry) => entry.name).sort()
  const records = await Promise.all(files.map(async (name) => {
    const file = path.join(directory, name)
    if ((await stat(file)).size > MAX_RECORD_BYTES) {
      throw new Error(`Private reading record ${name} is too large.`)
    }
    return parseRecord(JSON.parse(await readFile(file, "utf8")), file)
  }))
  return records.sort((a, b) => Date.parse(a.savedAt) - Date.parse(b.savedAt) || a.pageId.localeCompare(b.pageId, undefined, { numeric: true }))
}

export async function savePrivateReading(
  packId: string,
  courseId: string,
  input: { pageId: string; title: string; text: string },
): Promise<PrivateReadingRecord> {
  const root = await checkedRoot()
  const directory = courseDirectory(root, packId, courseId)
  const file = recordFile(directory, input.pageId)
  if (!isPrivateReadingInput(input)) {
    throw new Error("The private reading needs a title and text within the allowed size.")
  }
  await mkdir(directory, { recursive: true, mode: 0o700 })
  await chmod(directory, 0o700)
  const [physicalDirectory, physicalRoot] = await Promise.all([realpath(directory), physicalPath(root)])
  if (!isWithin(physicalRoot, physicalDirectory)) {
    throw new Error("The private reading directory points outside QUIZ_PRIVATE_DIR.")
  }
  const existing = await readPrivateReadings(packId, courseId)
  const savedAt = existing.find((record) => record.pageId === input.pageId)?.savedAt ?? new Date().toISOString()
  const record: PrivateReadingRecord = {
    pageId: input.pageId,
    title: input.title.trim(),
    text: input.text.trim(),
    savedAt,
  }
  const temporary = `${file}.${randomUUID()}.tmp`
  try {
    await writeFile(temporary, JSON.stringify(record), { encoding: "utf8", mode: 0o600, flag: "wx" })
    await rename(temporary, file)
  } finally {
    await rm(temporary, { force: true })
  }
  return record
}

export function privateReadingRoot(): string {
  return configuredRoot()
}
