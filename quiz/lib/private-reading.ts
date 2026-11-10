import { createHash, randomUUID } from "node:crypto"
import type { Dirent } from "node:fs"
import { chmod, mkdir, readFile, readdir, realpath, rename, rm, stat, writeFile } from "node:fs/promises"
import { homedir } from "node:os"
import path from "node:path"
import { repoRoot } from "./pack.ts"
import { PRIVATE_PAGE_ID } from "./page-id.ts"

const PACK_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const COURSE_ID = /^\d+$/
const PAGE_ID = PRIVATE_PAGE_ID
const MAX_TITLE_CHARS = 500
const MAX_TEXT_CHARS = 1_000_000
const MAX_RECORD_BYTES = 4_000_000
// What one course may hold, so nobody who can reach the capture route can fill the disk.
export const MAX_RECORDS_PER_COURSE = 300
export const MAX_COURSE_BYTES = 200_000_000

// The course is full: a new page is refused, replacing an existing page still works.
export class PrivateStoreLimitError extends Error {
  constructor() {
    super("This course's private store is full.")
    this.name = "PrivateStoreLimitError"
  }
}

// Parsed records, kept until a file in the course changes (its name, size or modified time), so a page view does not
// read and parse every saved reading again.
const recordCache = new Map<string, { stamp: string; records: PrivateReadingRecord[] }>()

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
  await assertOutsideRepository(root, repoRoot())
  return root
}

async function assertOutsideRepository(root: string, repositoryRoot: string): Promise<void> {
  const [physicalRoot, physicalRepo] = await Promise.all([physicalPath(root), realpath(repositoryRoot)])
  if (isWithin(physicalRepo, physicalRoot)) {
    throw new Error("Private readings must be stored outside the repository.")
  }
  for (let ancestor = physicalRoot; ; ancestor = path.dirname(ancestor)) {
    try {
      await stat(path.join(ancestor, ".git"))
      throw new Error("Private readings must be stored outside the repository.")
    } catch (error) {
      if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") throw error
    }
    if (path.dirname(ancestor) === ancestor) break
  }
}

export async function assertPrivateReadingOutsideRepo(repositoryRoot: string): Promise<void> {
  await assertOutsideRepository(configuredRoot(), repositoryRoot)
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
  if (entries.some((entry) => entry.isSymbolicLink())) {
    throw new Error("The private reading store must not contain linked records.")
  }
  const files = entries.filter((entry) => entry.isFile() && entry.name.endsWith(".json")).map((entry) => entry.name).sort()
  const stats = await Promise.all(files.map(async (name) => ({ name, info: await stat(path.join(directory, name)) })))
  for (const { name, info } of stats) {
    if (info.size > MAX_RECORD_BYTES) throw new Error(`Private reading record ${name} is too large.`)
  }
  const stamp = stats.map(({ name, info }) => `${name}:${info.size}:${info.mtimeMs}`).join("|")
  const kept = recordCache.get(directory)
  if (kept?.stamp === stamp) return kept.records
  const records = await Promise.all(files.map(async (name) => {
    const file = path.join(directory, name)
    return parseRecord(JSON.parse(await readFile(file, "utf8")), file)
  }))
  const sorted = sortRecords(records)
  recordCache.set(directory, { stamp, records: sorted })
  return sorted
}

function sortRecords(records: PrivateReadingRecord[]): PrivateReadingRecord[] {
  return records.sort((a, b) => Date.parse(a.savedAt) - Date.parse(b.savedAt) || a.pageId.localeCompare(b.pageId, undefined, { numeric: true }))
}

export async function allPrivateReadings(): Promise<PrivateReadingRecord[]> {
  const root = await checkedRoot()
  async function directories(directory: string, pattern: RegExp): Promise<string[]> {
    let entries: Dirent[]
    try {
      entries = await readdir(directory, { withFileTypes: true })
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") return []
      throw error
    }
    if (entries.some((entry) => entry.isSymbolicLink())) throw new Error("The private reading store must not contain linked directories.")
    return entries.filter((entry) => entry.isDirectory() && pattern.test(entry.name)).map((entry) => entry.name)
  }
  const records: PrivateReadingRecord[] = []
  for (const pack of await directories(root, PACK_ID)) {
    for (const course of await directories(path.join(root, pack), COURSE_ID)) {
      records.push(...await readPrivateReadings(pack, course))
    }
  }
  return records
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
  const [physicalDirectory, physicalRoot] = await Promise.all([physicalPath(directory), physicalPath(root)])
  if (!isWithin(physicalRoot, physicalDirectory)) {
    throw new Error("The private reading directory points outside QUIZ_PRIVATE_DIR.")
  }
  for (const part of [root, path.join(root, packId), directory]) {
    await mkdir(part, { recursive: true, mode: 0o700 })
    await chmod(part, 0o700)
  }
  const listed = (await readdir(directory, { withFileTypes: true })).filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
  const sizes = await Promise.all(listed.map(async (entry) => ({ name: entry.name, size: (await stat(path.join(directory, entry.name))).size })))
  const replacing = sizes.find((entry) => entry.name === path.basename(file))
  const others = sizes.filter((entry) => entry !== replacing)
  const newBytes = new TextEncoder().encode(input.text.trim()).byteLength + new TextEncoder().encode(input.title.trim()).byteLength
  if (others.length + 1 > MAX_RECORDS_PER_COURSE || others.reduce((sum, entry) => sum + entry.size, 0) + newBytes > MAX_COURSE_BYTES) {
    throw new PrivateStoreLimitError()
  }
  // Only the page being replaced is read, to keep the day it was first saved.
  let savedAt = new Date().toISOString()
  if (replacing) {
    try {
      savedAt = parseRecord(JSON.parse(await readFile(file, "utf8")), file).savedAt
    } catch {
      // A damaged copy of this page is being replaced by a good one, so its old date is not worth keeping.
    }
  }
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
