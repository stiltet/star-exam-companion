import { appendFileSync, copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, statSync } from "node:fs"
import path from "node:path"
import { chronological, parseScoreLines, parseSections, parseWeights } from "./learn.ts"
import { DEFAULT_EXAM, examId, loadPack, packDir, repoRoot } from "./pack.ts"
import { BACKUP_DIR } from "./reset.ts"
import { itemsFromGlossary } from "./round.ts"
import { parseGlossary } from "./sources.ts"
import { voiceIndex } from "./speak.ts"

// Each exam keeps its own scores file, named after it, so two exams never mix answers and a copied
// file says which exam it is. QUIZ_SCORES_FILE points a test instance at one scratch file, and
// QUIZ_SCORES_DIR at a scratch folder that keeps a file per exam, so a test never writes real scores.
export function scoresFile(root: string, id: string = examId(root)): string {
  if (process.env.QUIZ_SCORES_FILE) return process.env.QUIZ_SCORES_FILE
  return path.join(process.env.QUIZ_SCORES_DIR || path.join(root, "quiz"), `scores-${id}.jsonl`)
}

let migrated = false

// Before the file carried the exam, the one scores file was quiz/scores.jsonl and the quiz was
// Generative AI Leader's. The default exam takes that file over once, after copying it into
// scores-backups/. Another exam never touches it. A plain file that appears later, written by an older
// build after a rollback, is merged into the exam's file by answer id at the next start.
// For tests: forget that the migration ran, as a restarted quiz would.
export function forgetLegacyMigration(): void {
  migrated = false
}

export function migrateLegacyScores(root: string): void {
  if (migrated || process.env.QUIZ_SCORES_FILE || process.env.QUIZ_SCORES_DIR) return
  // Only the default exam migrates, so another exam running first must not spend the one-time flag.
  if (examId(root) !== DEFAULT_EXAM) return
  const legacy = path.join(root, "quiz/scores.jsonl")
  const target = scoresFile(root)
  if (!existsSync(legacy)) {
    migrated = true
    return
  }
  const backups = path.join(root, "quiz", BACKUP_DIR)
  mkdirSync(backups, { recursive: true })
  // A first backup keeps its plain name; a later one, after a rollback and a second move, gets the time, so it never overwrites.
  const first = path.join(backups, `scores-${DEFAULT_EXAM}-before-exam-names.jsonl`)
  const backup = existsSync(first) ? path.join(backups, `scores-${DEFAULT_EXAM}-before-exam-names-${Date.now()}.jsonl`) : first
  if (!existsSync(target)) {
    copyFileSync(legacy, backup)
    renameSync(legacy, target)
  } else {
    // An older build wrote a plain file after the move (a rollback, then an upgrade again). Its answers join
    // the exam's own file by answer id, so none is lost and none is counted twice, and the plain file goes
    // to scores-backups/ under a name with the time.
    const known = new Set(readScores(target).lines.flatMap((line) => (line.id ? [line.id] : [])))
    const extra = readFileSync(legacy, "utf8").split("\n").filter((line) => {
      if (!line.trim()) return false
      const id = (parseScoreLines(line).lines[0] as { id?: string } | undefined)?.id
      return !id || !known.has(id)
    })
    if (extra.length > 0) appendFileSync(target, `${extra.join("\n")}\n`)
    renameSync(legacy, path.join(backups, `scores-${DEFAULT_EXAM}-plain-file-${Date.now()}.jsonl`))
  }
  // Set only after the move, so a failed copy is tried again on the next request instead of being forgotten.
  migrated = true
}

export function readScores(file: string) {
  return existsSync(file) ? parseScoreLines(readFileSync(file, "utf8")) : { lines: [], skipped: 0 }
}

export function loadPlay() {
  const root = repoRoot()
  const pack = loadPack(root)
  const parsed = parseGlossary(pack.glossaryText)
  if (!parsed.ok) return parsed
  migrateLegacyScores(root)
  const { lines, skipped } = readScores(scoresFile(root))
  return {
    ok: true as const,
    pack,
    bank: { questions: pack.study.questions, sectionOf: pack.meta.sectionOf },
    glossary: parsed.glossary,
    items: itemsFromGlossary(parsed.glossary, pack.scenes),
    weights: parseWeights(pack.sectionsText),
    sections: parseSections(pack.sectionsText),
    lines: chronological(lines),
    skippedLines: skipped,
    root,
  }
}

// The quiz's spoken lines come from the glossary and the scenes, so their keys change only when one
// does. Each clip request reads this, so it is rebuilt only when either file's modification time moves.
let voiceCache: { stamp: string; index: Map<string, string> } | null = null

export function loadVoiceIndex(): Map<string, string> | null {
  try {
    const id = examId(repoRoot())
    const dir = packDir(repoRoot(), id)
    const glossary = path.join(dir, "glossary.md")
    const scenes = path.join(dir, "scenes.json")
    // A pack file missing mid-checkout is a 404 for the clip, not a crash.
    if (!existsSync(glossary) || !existsSync(scenes)) return null
    const stamp = `${dir}:${statSync(glossary).mtimeMs}:${statSync(scenes).mtimeMs}`
    if (voiceCache?.stamp === stamp) return voiceCache.index
    const parsed = parseGlossary(readFileSync(glossary, "utf8"))
    if (!parsed.ok) return null
    voiceCache = { stamp, index: voiceIndex(itemsFromGlossary(parsed.glossary, loadPack(repoRoot(), id).scenes)) }
    return voiceCache.index
  } catch {
    // A pack file that does not read is a 404 for the clip, not a crash; the pack test names what is wrong.
    return null
  }
}
