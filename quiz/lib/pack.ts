import { existsSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs"
import path from "node:path"
import type { Question, StudySection } from "./exam-data.ts"
import type { Course } from "./reading.ts"
import { DEFAULT_EXAM } from "./scope.ts"

// An exam pack is the folder exams/<id>/ at the repo root: everything that makes this the quiz
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
  // Said on the home, Practice and Exam pages while the pack is unfinished, such as "17 terms so far". Absent when it is finished.
  notice?: string
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
}

// Where the Progress page keeps the exam this install serves. A test points it elsewhere.
export function settingFile(root: string = repoRoot()): string {
  return process.env.QUIZ_EXAM_SETTING_FILE || path.join(root, "quiz", "active-exam.json")
}

function isPackFolder(root: string, id: string): boolean {
  return ID_PATTERN.test(id) && existsSync(path.join(root, "exams", id, "pack.json"))
}

// Whether a pack's pack.json reads. A chosen pack that no longer does is ignored, so the Progress page, where
// the exam is switched, still opens and the exam can be changed back.
function packReads(root: string, id: string): boolean {
  try {
    checkMeta(readJson(path.join(root, "exams", id, "pack.json")), id)
    return true
  } catch {
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
  const file = settingFile(root)
  const temporary = `${file}.${process.pid}.tmp`
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
  if (!existsSync(file)) throw new Error(`Exam pack ${path.basename(dir)} has no ${name}`)
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
  if (!ok) throw new Error(`Exam pack ${id}: pack.json needs id "${id}", title, certification, description, unnumberedLabel, examPage, examGuide, learningPath, exam {questions, minutes}, reading, links and sectionOf`)
  return meta as PackMeta
}

// courses.json: { path, bundleBase, courses: [{ id, template, title, folder }] }, each course carrying
// the path and bundle base so it describes itself.
function readCourses(file: string, id: string): Course[] {
  const data = readJson(file) as { path?: unknown; bundleBase?: unknown; courses?: unknown } | null
  const list = data?.courses
  if (!data || !isText(data.path) || !isText(data.bundleBase) || !Array.isArray(list) || list.length === 0) {
    throw new Error(`Exam pack ${id}: courses.json needs path, bundleBase and a list of courses`)
  }
  // The Mac fetches the text from bundleBase: only Google's public course bucket, and a path on Google Skills.
  if (!data.bundleBase.startsWith("https://storage.googleapis.com/") || !data.path.startsWith("https://www.skills.google/")) {
    throw new Error(`Exam pack ${id}: courses.json bundleBase must be on https://storage.googleapis.com/ and path on https://www.skills.google/`)
  }
  const seen = new Set<string>()
  return list.map((entry: Partial<Course>) => {
    if (!isText(entry.id) || !/^\d+$/.test(entry.id) || !isText(entry.template) || !/^\d+$/.test(entry.template) || !isText(entry.title) || !isText(entry.folder)) {
      throw new Error(`Exam pack ${id}: a course in courses.json needs a numeric id and template, a title and a folder`)
    }
    if (entry.folder.split("/").some((part) => part === "" || part === "." || part === "..")) throw new Error(`Exam pack ${id}: a course folder in courses.json may not contain empty, . or .. parts`)
    if (seen.has(entry.id)) throw new Error(`Exam pack ${id}: course id ${entry.id} repeats in courses.json`)
    seen.add(entry.id)
    return { id: entry.id, template: entry.template, title: entry.title, folder: entry.folder, bundleBase: data.bundleBase as string, path: data.path as string }
  })
}

export function loadPack(root: string, id: string = examId(root)): Pack {
  const dir = packDir(root, id)
  const meta = checkMeta(readJson(requirePackFile(dir, "pack.json")), id)
  const scenes = readJson(requirePackFile(dir, "scenes.json"))
  const study = readJson(requirePackFile(dir, "study.json")) as Partial<Study> | null
  if (!Array.isArray(scenes)) throw new Error(`Exam pack ${id}: scenes.json must be a list`)
  if (!study || !Array.isArray(study.sections) || !Array.isArray(study.questions)) {
    throw new Error(`Exam pack ${id}: study.json needs sections and questions`)
  }
  const courses = meta.reading ? readCourses(requirePackFile(dir, "courses.json"), id) : []
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
  }
}

// The repo root as the running app finds it: the quiz is started from quiz/.
export function repoRoot(): string {
  return path.resolve(process.cwd(), "..")
}

// The pack the running app serves. Pages read it per request.
export function activePack(): Pack {
  return loadPack(repoRoot())
}
