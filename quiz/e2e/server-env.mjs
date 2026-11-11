import path from "node:path"

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
    QUIZ_EXAM: "generative-ai-leader",
    QUIZ_EXAM_SETTING_FILE: path.join(scratch, "active-exam.json"),
    NIGHT_DIR: path.join(scratch, "night"),
  }
}
