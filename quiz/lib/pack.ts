import { existsSync, readFileSync, statSync } from "node:fs"
import path from "node:path"
import type { Question, StudySection } from "./exam-data.ts"
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
  examPage: string
  examGuide: string
  // Extra footer links the exam has: its learning path, sample questions.
  links: { label: string; href: string }[]
  // Glossary terms no scene asks, such as a second name for a product that is not a rename.
  notAsked?: string[]
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
}

// The exam this install serves: QUIZ_EXAM, else the default. One exam per install.
export function examId(): string {
  return process.env.QUIZ_EXAM || DEFAULT_EXAM
}

export function packDir(root: string, id: string = examId()): string {
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

function checkMeta(value: unknown, id: string): PackMeta {
  const meta = value as Partial<PackMeta> | null
  const sectionOf = meta?.sectionOf
  const ok =
    meta !== null &&
    typeof meta === "object" &&
    meta.id === id &&
    isText(meta.title) &&
    isText(meta.certification) &&
    isText(meta.examPage) &&
    isText(meta.examGuide) &&
    typeof meta.reading === "boolean" &&
    Number.isInteger(meta.exam?.questions) &&
    Number.isInteger(meta.exam?.minutes) &&
    (meta.exam?.questions ?? 0) > 0 &&
    (meta.exam?.minutes ?? 0) > 0 &&
    Array.isArray(meta.links) &&
    meta.links.every((link) => isText(link?.label) && isText(link?.href)) &&
    sectionOf !== null &&
    typeof sectionOf === "object" &&
    Object.values(sectionOf).every(isText)
  if (!ok) throw new Error(`Exam pack ${id}: pack.json needs id "${id}", title, certification, examPage, examGuide, exam {questions, minutes}, reading, links and sectionOf`)
  return meta as PackMeta
}

export function loadPack(root: string, id: string = examId()): Pack {
  const dir = packDir(root, id)
  const meta = checkMeta(readJson(requirePackFile(dir, "pack.json")), id)
  const scenes = readJson(requirePackFile(dir, "scenes.json"))
  const study = readJson(requirePackFile(dir, "study.json")) as Partial<Study> | null
  if (!Array.isArray(scenes)) throw new Error(`Exam pack ${id}: scenes.json must be a list`)
  if (!study || !Array.isArray(study.sections) || !Array.isArray(study.questions)) {
    throw new Error(`Exam pack ${id}: study.json needs sections and questions`)
  }
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
