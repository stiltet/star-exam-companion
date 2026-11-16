import path from "node:path"
import { fileURLToPath } from "node:url"
import { DEFAULT_EXAM, loadPack } from "./pack.ts"

// The exam the tests run against: Generative AI Leader's, whatever QUIZ_EXAM says.
export const testRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
export const testPack = loadPack(testRoot, DEFAULT_EXAM)
export const testBank = { questions: testPack.study.questions, sectionOf: testPack.meta.sectionOf }

// Runs `run` while the Mac serves `exam`, as if it had been chosen with QUIZ_EXAM and no Progress page choice, then
// puts both settings back.
export async function whileServing<T>(exam: string, run: () => Promise<T>): Promise<T> {
  const before = { exam: process.env.QUIZ_EXAM, setting: process.env.QUIZ_EXAM_SETTING_FILE }
  process.env.QUIZ_EXAM = exam
  process.env.QUIZ_EXAM_SETTING_FILE = "/nonexistent/active-exam.json"
  try {
    return await run()
  } finally {
    if (before.exam === undefined) delete process.env.QUIZ_EXAM
    else process.env.QUIZ_EXAM = before.exam
    if (before.setting === undefined) delete process.env.QUIZ_EXAM_SETTING_FILE
    else process.env.QUIZ_EXAM_SETTING_FILE = before.setting
  }
}
