import path from "node:path"
import { fileURLToPath } from "node:url"
import { DEFAULT_EXAM, loadPack } from "./pack.ts"

// The exam pack the tests run against: Generative AI Leader's, whatever QUIZ_EXAM says.
export const testRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
export const testPack = loadPack(testRoot, DEFAULT_EXAM)
export const testBank = { questions: testPack.study.questions, sectionOf: testPack.meta.sectionOf }
