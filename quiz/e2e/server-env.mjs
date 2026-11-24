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

// The browser tests run on two workers, each with a server of its own: the server keeps the chosen exam, the scores, the
// Night recording and the private readings, so two workers on one server would reset and switch each other's state.
export const E2E_WORKERS = 2

/** The port of the server that worker `index` uses: the base port, then the next one. */
export function e2ePortFor(basePort, index) {
  return basePort + index
}

/** The port the browser tests use when QUIZ_E2E_PORT is not set. */
export const E2E_DEFAULT_PORT = 47822

/** QUIZ_E2E_PORT, or the default. For the tests and the config it is the first worker's port; each server reads its own. */
export function e2eBasePort(env = process.env) {
  return Number(env.QUIZ_E2E_PORT ?? E2E_DEFAULT_PORT)
}
