import { randomUUID } from "node:crypto"
import { existsSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs"
import path from "node:path"
import type { Question, StudySection } from "./exam-data.ts"
import type { Course } from "./reading-view.ts"
import { DEFAULT_EXAM } from "./scope.ts"
import { parseGlossary } from "./sources.ts"

// An exam is the folder exams/<id>/ at the repo root: everything that makes this the quiz
// for one exam. The app code holds no exam content. docs/exam-packs.md describes the format.

export { DEFAULT_EXAM } from "./scope.ts"

const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

// One voice scene: a decision with one right term and three wrong ones that sound plausible.
export type Scene = {
  id: string
  // The course that teaches this, when the pack has a courses list. Absent otherwise.
  course?: string
  correct: string
  distractors: [string, string, string]
  scene: string
  constraint: string
  // Exam-guide section for a study-guide term the exam guide does not name.
  guide?: string
}

export type PackMeta = {
  id: string
  // Shown in the page header and the About page, such as "Generative AI Leader".
  title: string
  // The certification's full name, for the page description.
  certification: string
  // A short description of the exam, shown on the home page above Exam Structure.
  description: string
  // Static Pages-demo notice. The local Read Aloud page computes its notice from available reading sources.
  notice?: string
  // A yellow warning box on the home page above the description, such as an exam that is unfinished. Only a pack that sets it shows one.
  homeNotice?: string
  // Extra search keywords for the page's metadata, beside Google Cloud, Certification, Exam Prep and the title.
  keywords?: string[]
  // The Glossary and Flashcards group for a term the exam guide does not number, such as "Study guide".
  unnumberedLabel: string
  examPage: string
  examGuide: string
  // Extra footer links the exam has: its learning path, sample questions.
  links: { label: string; href: string }[]
  // Glossary terms no scene asks, such as a second name for a product that is not a rename.
  notAsked?: string[]
  // Google's official learning path for the exam: the home page's OFFICIAL LEARNING PATH button.
  learningPath: string
  // The Practice exam's length, as the real exam's.
  exam: { questions: number; minutes: number }
  // Whether the exam has an official course to read aloud (the /read pages).
  reading: boolean
  // Maps a study section id (study.json) to its exam-guide section number.
  sectionOf: Record<string, string>
}

export type Study = { sections: StudySection[]; questions: Question[] }

export type Pack = {
  meta: PackMeta
  dir: string
  glossaryText: string
  sectionsText: string
  terms: string[]
  scenes: Scene[]
  study: Study
  // The learning path's courses for Read Aloud, from courses.json. Empty when the pack has none.
  courses: Course[]
  // Courses of the same path that Read Aloud cannot read, each with the plain reason, from courses.json.
  noReading: NoReading[]
}

// A course of the learning path with nothing the quiz can read aloud: the Read Aloud page lists it and says why.
export type NoReading = { id: string; template: string; title: string; why: string }

// Where the Progress page keeps the exam this install serves. A test points it elsewhere.
export function settingFile(root: string = repoRoot()): string {
  return process.env.QUIZ_EXAM_SETTING_FILE || path.join(root, "quiz", "active-exam.json")
}

function isPackFolder(root: string, id: string): boolean {
  return ID_PATTERN.test(id) && existsSync(path.join(root, "exams", id, "pack.json"))
}

// Whether a pack loads, every file of it, and its glossary parses, as the pages need. A chosen pack that no longer
// does is ignored, so the Progress page, where the exam is switched, still opens and the exam can be changed back.
function packReads(root: string, id: string): boolean {
  try {
    return parseGlossary(loadPack(root, id).glossaryText).ok
  } catch {
    // Any file of the pack that does not load means the pack cannot be served: the choice is ignored, not reported,
    // so the page that switches the exam still opens. The pack test names what is wrong with a pack.
    return false
  }
}

// The exam this install serves: the one chosen on the Progress page, else QUIZ_EXAM, else the
// default. One exam at a time, for every device. A choice naming a pack that is gone is ignored.
export function examId(root: string = repoRoot()): string {
  try {
    const chosen: unknown = JSON.parse(readFileSync(settingFile(root), "utf8"))
    const id = (chosen as { exam?: unknown } | null)?.exam
    if (typeof id === "string" && isPackFolder(root, id) && packReads(root, id)) return id
  } catch {
    // No choice yet, or an unreadable file: fall through to the environment.
  }
  return process.env.QUIZ_EXAM || DEFAULT_EXAM
}

// Every pack in exams/, for the Progress page's switch.
export function listPacks(root: string = repoRoot()): { id: string; title: string }[] {
  const found: { id: string; title: string }[] = []
  for (const entry of readdirSync(path.join(root, "exams"), { withFileTypes: true })) {
    if (!entry.isDirectory() || !isPackFolder(root, entry.name)) continue
    try {
      const meta = checkMeta(readJson(path.join(root, "exams", entry.name, "pack.json")), entry.name)
      found.push({ id: meta.id, title: meta.title })
    } catch {
      // A pack that does not read is left out of the list; the pack test names what is wrong.
    }
  }
  return found.sort((a, b) => a.title.localeCompare(b.title))
}

// Switches the exam for every device. Only a pack that is in exams/ can be chosen.
export function setActiveExam(id: string, root: string = repoRoot()): boolean {
  if (!listPacks(root).some((pack) => pack.id === id)) return false
  // A pack whose other files do not load would be saved and then ignored by examId, so the switch would say it worked.
  if (!packReads(root, id)) return false
  const file = settingFile(root)
  // One name per call: two switches at once in one process must not share a temporary file.
  const temporary = `${file}.${process.pid}.${randomUUID()}.tmp`
  writeFileSync(temporary, `${JSON.stringify({ exam: id })}\n`)
  renameSync(temporary, file)
  return true
}

export function packDir(root: string, id: string = examId(root)): string {
  // The id becomes a path, so it is a plain slug: no separators, no dots.
  if (!ID_PATTERN.test(id)) throw new Error(`QUIZ_EXAM "${id}" is not a pack name: use lower case words joined by hyphens`)
  return path.join(root, "exams", id)
}

const jsonCache = new Map<string, { stamp: number; value: unknown }>()

// Each request reads its pack, so a parsed file is reused until its modification time moves.
function readJson(file: string): unknown {
  const stamp = statSync(file).mtimeMs
  const hit = jsonCache.get(file)
  if (hit?.stamp === stamp) return hit.value
  const value: unknown = JSON.parse(readFileSync(file, "utf8"))
  jsonCache.set(file, { stamp, value })
  return value
}

function requirePackFile(dir: string, name: string): string {
  const file = path.join(dir, name)
  if (!existsSync(file)) throw new Error(`Exam ${path.basename(dir)} has no ${name}`)
  return file
}

function isText(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== ""
}

// A pack arrives by pull request, so every link in it must be https: a link is shown as an anchor, and a pack's
// text bundles are fetched by the Mac, so neither may name another scheme.
function isHttps(value: unknown): value is string {
  if (!isText(value)) return false
  try {
    return new URL(value).protocol === "https:"
  } catch {
    // Not a URL at all, so it is not an https link: the caller rejects the pack.
    return false
  }
}

function checkMeta(value: unknown, id: string): PackMeta {
  const meta = value as Partial<PackMeta> | null
  const sectionOf = meta?.sectionOf
  const ok =
    meta !== null &&
    typeof meta === "object" &&
    meta.id === id &&
    isText(meta.title) &&
    isText(meta.certification) &&
    isText(meta.description) &&
    isText(meta.unnumberedLabel) &&
    (meta.notice === undefined || isText(meta.notice)) &&
    (meta.homeNotice === undefined || isText(meta.homeNotice)) &&
    (meta.keywords === undefined || (Array.isArray(meta.keywords) && meta.keywords.every(isText))) &&
    isHttps(meta.examPage) &&
    isHttps(meta.examGuide) &&
    isHttps(meta.learningPath) &&
    typeof meta.reading === "boolean" &&
    Number.isInteger(meta.exam?.questions) &&
    Number.isInteger(meta.exam?.minutes) &&
    (meta.exam?.questions ?? 0) > 0 &&
    (meta.exam?.minutes ?? 0) > 0 &&
    Array.isArray(meta.links) &&
    meta.links.every((link) => isText(link?.label) && isHttps(link?.href)) &&
    sectionOf !== null &&
    typeof sectionOf === "object" &&
    Object.values(sectionOf).every(isText)
  if (!ok) throw new Error(`Exam ${id}: pack.json needs id "${id}", title, certification, description, unnumberedLabel, examPage, examGuide, learningPath, exam {questions, minutes}, reading, links and sectionOf`)
  return meta as PackMeta
}

// courses.json: { path, bundleBase, courses: [{ id, template, title, provider?, folder?, format? }] }.
function readCourses(file: string, id: string): Course[] {
  const data = readJson(file) as { path?: unknown; bundleBase?: unknown; courses?: unknown } | null
  const list = data?.courses
  const coursePath = data?.path
  const bundleBase = data?.bundleBase
  if (!data || !isText(coursePath) || !isText(bundleBase) || !Array.isArray(list) || list.length === 0) {
    throw new Error(`Exam ${id}: courses.json needs path, bundleBase and a list of courses`)
  }
  // The Mac fetches the text from bundleBase: only Google's public course bucket, and a path on Google Skills.
  if (!bundleBase.startsWith("https://storage.googleapis.com/") || !coursePath.startsWith("https://www.skills.google/")) {
    throw new Error(`Exam ${id}: courses.json bundleBase must be on https://storage.googleapis.com/ and path on https://www.skills.google/`)
  }
  const seen = new Set<string>()
  return list.map((entry: Partial<Course>) => {
    const provider = entry.provider ?? "google"
    if (provider !== "google" && provider !== "private") {
      throw new Error(`Exam ${id}: a course provider in courses.json can only be "google" or "private"`)
    }
    if (!isText(entry.id) || !/^\d+$/.test(entry.id) || !isText(entry.template) || !/^\d+$/.test(entry.template) || !isText(entry.title)) {
      throw new Error(`Exam ${id}: a course in courses.json needs a numeric id and template and a title`)
    }
    if (provider === "google" && !isText(entry.folder)) {
      throw new Error(`Exam ${id}: a Google course in courses.json needs a folder`)
    }
    if (entry.folder !== undefined && !isText(entry.folder)) {
      throw new Error(`Exam ${id}: a course folder in courses.json must be non-empty text`)
    }
    if (provider === "private" && entry.folder !== undefined) {
      throw new Error(`Exam ${id}: a private course in courses.json cannot have a public bundle folder`)
    }
    if (entry.folder?.split("/").some((part) => part === "" || part === "." || part === "..")) throw new Error(`Exam ${id}: a course folder in courses.json may not contain empty, . or .. parts`)
    if (seen.has(entry.id)) throw new Error(`Exam ${id}: course id ${entry.id} repeats in courses.json`)
    if (entry.format !== undefined && entry.format !== "rise") throw new Error(`Exam ${id}: a course format in courses.json can only be "rise"`)
    if (provider === "private" && entry.format !== undefined) throw new Error(`Exam ${id}: a private course in courses.json cannot have a public bundle format`)
    seen.add(entry.id)
    const course: Course = {
      id: entry.id,
      template: entry.template,
      title: entry.title,
      packId: id,
      provider,
      bundleBase,
      path: coursePath,
      ...(entry.folder ? { folder: entry.folder } : {}),
    }
    return entry.format ? { ...course, format: entry.format } : course
  })
}

// courses.json may also hold `noReading`: [{ id, template, title, why }], the path's courses that have no text to read.
function readNoReading(file: string, id: string): NoReading[] {
  const data = readJson(file) as { noReading?: unknown; courses?: { id?: unknown }[] } | null
  const list = data?.noReading
  if (list === undefined) return []
  if (!Array.isArray(list)) throw new Error(`Exam ${id}: noReading in courses.json must be a list`)
  const taken = new Set(data?.courses?.map((course) => String(course.id)))
  return list.map((entry: Partial<NoReading>) => {
    if (!isText(entry?.id) || !/^\d+$/.test(entry.id) || !isText(entry.template) || !/^\d+$/.test(entry.template) || !isText(entry.title) || !isText(entry.why)) {
      throw new Error(`Exam ${id}: a noReading course in courses.json needs a numeric id and template, a title and a why`)
    }
    if (taken.has(entry.id)) throw new Error(`Exam ${id}: course id ${entry.id} repeats in courses.json`)
    taken.add(entry.id)
    return { id: entry.id, template: entry.template, title: entry.title, why: entry.why }
  })
}

const PACK_FILES = ["pack.json", "scenes.json", "study.json", "courses.json", "terms.txt", "glossary.md", "sections.md"]
const packCache = new Map<string, { stamp: string; pack: Pack }>()

function containsPrivateReadingRecord(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsPrivateReadingRecord)
  if (!value || typeof value !== "object") return false
  const record = value as Record<string, unknown>
  if (
    typeof record.pageId === "string" &&
    typeof record.title === "string" &&
    typeof record.text === "string" &&
    typeof record.savedAt === "string"
  ) return true
  return Object.values(record).some(containsPrivateReadingRecord)
}

function assertNoPrivateReadingFiles(dir: string, id: string): void {
  if (!existsSync(dir)) return
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) {
      throw new Error(`Exam ${id} must not contain linked files.`)
    }
    if (entry.isDirectory()) {
      if (/^private-readings?$/i.test(entry.name)) {
        throw new Error(`Exam ${id} must not contain private reading files.`)
      }
      assertNoPrivateReadingFiles(path.join(dir, entry.name), id)
    } else if (entry.isFile() && entry.name.endsWith(".json")) {
      const file = path.join(dir, entry.name)
      if (containsPrivateReadingRecord(readJson(file))) {
        throw new Error(`Exam ${id} must not contain private reading files.`)
      }
    }
  }
}

// A pack is read once and served from memory until one of its files changes: every page, route and exam check
// asks for it, and without this each ask read and parsed all of it again.
function packStamp(dir: string): string {
  return PACK_FILES.map((name) => {
    try {
      const stat = statSync(path.join(dir, name))
      return `${stat.mtimeMs}:${stat.size}`
    } catch {
      // A file that is not there (courses.json of a pack with no course) has no stamp; one that appears changes the key.
      return "-"
    }
  }).join("|")
}

// The name, size and modified time of everything under the pack folder, so a file added or changed anywhere in it,
// including one with an unrelated name, changes the stamp and gets the private-reading scan again.
function treeStamp(dir: string): string {
  const parts: string[] = []
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    // A pack folder that is not there has no stamp; readPack then says which file it lacks.
    return "-"
  }
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const file = path.join(dir, entry.name)
    if (entry.isSymbolicLink()) parts.push(`${entry.name}:link`)
    else if (entry.isDirectory()) parts.push(`${entry.name}/{${treeStamp(file)}}`)
    else {
      const stat = statSync(file)
      parts.push(`${entry.name}:${stat.mtimeMs}:${stat.size}`)
    }
  }
  return parts.join(",")
}

export function loadPack(root: string, id: string = examId(root)): Pack {
  const dir = packDir(root, id)
  const stamp = `${packStamp(dir)}#${treeStamp(dir)}`
  const cached = packCache.get(dir)
  if (cached?.stamp === stamp) return cached.pack
  // Only a pack that is new or changed is scanned and parsed again.
  assertNoPrivateReadingFiles(dir, id)
  const pack = readPack(dir, id)
  packCache.set(dir, { stamp, pack })
  return pack
}

function readPack(dir: string, id: string): Pack {
  const metaData = readJson(requirePackFile(dir, "pack.json"))
  const scenes = readJson(requirePackFile(dir, "scenes.json"))
  const study = readJson(requirePackFile(dir, "study.json")) as Partial<Study> | null
  const meta = checkMeta(metaData, id)
  if (!Array.isArray(scenes)) throw new Error(`Exam ${id}: scenes.json must be a list`)
  if (!study || !Array.isArray(study.sections) || !Array.isArray(study.questions)) {
    throw new Error(`Exam ${id}: study.json needs sections and questions`)
  }
  const courses = meta.reading ? readCourses(requirePackFile(dir, "courses.json"), id) : []
  const noReading = meta.reading ? readNoReading(requirePackFile(dir, "courses.json"), id) : []
  const terms = readFileSync(requirePackFile(dir, "terms.txt"), "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
  return {
    meta,
    dir,
    glossaryText: readFileSync(requirePackFile(dir, "glossary.md"), "utf8"),
    sectionsText: readFileSync(requirePackFile(dir, "sections.md"), "utf8"),
    terms,
    scenes: scenes as Scene[],
    study: { sections: study.sections, questions: study.questions },
    courses,
    noReading,
  }
}

// The repo root as the running app finds it: the quiz is started from quiz/.
// QUIZ_ROOT points a test instance at a scratch copy of exams/, so a test can serve a pack the repo does not ship.
export function repoRoot(): string {
  return process.env.QUIZ_ROOT || path.resolve(process.cwd(), "..")
}

// The pack the running app serves. Pages read it per request.
export function activePack(): Pack {
  return loadPack(repoRoot())
}
