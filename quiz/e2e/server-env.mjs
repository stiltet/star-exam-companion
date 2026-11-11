import { tmpdir } from "node:os"
import path from "node:path"

// A fixed scratch folder per port, so the tests know where the server keeps its private readings.
export function e2eScratch(port) {
  return path.join(tmpdir(), `quiz-e2e-scratch-${port}`)
}

export function browserServerEnv(parent, scratch, root) {
  return {
    ...parent,
    TMPDIR: scratch,
    TMP: scratch,
    TEMP: scratch,
    NEXT_TELEMETRY_DISABLED: "1",
    QUIZ_DIST_DIR: ".next-e2e",
    QUIZ_SCORES_FILE: "",
    QUIZ_SCORES_DIR: path.join(scratch, "scores"),
    QUIZ_ROOT: root,
    QUIZ_PRIVATE_DIR: path.join(scratch, "private-reading"),
    QUIZ_EXAM: "generative-ai-leader",
    QUIZ_EXAM_SETTING_FILE: path.join(scratch, "active-exam.json"),
    NIGHT_DIR: path.join(scratch, "night"),
  }
}
