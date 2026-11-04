import { appendFileSync } from "node:fs"
import path from "node:path"
import { settingFile } from "./pack.ts"

// A record of every exam switch, so "when did the quiz change exam?" has an answer. One line each, appended to
// exam-switches.log next to the file that holds the chosen exam (git ignores it, like the choice itself).
export function examLogFile(root?: string): string {
  return path.join(path.dirname(settingFile(root)), "exam-switches.log")
}

// Writes `<ISO time> switched from <old> to <new>`. A switch to the exam already served leaves no line. A log that
// cannot be written never fails the switch: the exam is already changed, and the line is a convenience.
export function recordExamSwitch(from: string, to: string, root?: string, now: () => Date = () => new Date()): void {
  if (from === to) return
  const file = examLogFile(root)
  const line = `${now().toISOString()} switched from ${from} to ${to}\n`
  try {
    appendFileSync(file, line)
  } catch (error) {
    console.error("Could not write the exam switch audit log:", error)
  }
}
