import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, statSync } from "node:fs"
import path from "node:path"
import { chronological, parseScoreLines, parseSections, parseWeights } from "./learn.ts"
import { DEFAULT_EXAM, examId, loadPack, packDir, repoRoot } from "./pack.ts"
import { BACKUP_DIR } from "./reset.ts"
import { itemsFromGlossary } from "./round.ts"
import { parseGlossary } from "./sources.ts"
import { voiceIndex } from "./speak.ts"

// Each exam keeps its own scores file, named after it, so two exams never mix answers and a copied
// file says which exam it is. QUIZ_SCORES_FILE points a test instance at a scratch file, so a test
// never writes real scores.
export function scoresFile(root: string, id: string = examId(root)): string {
  return process.env.QUIZ_SCORES_FILE || path.join(root, "quiz", `scores-${id}.jsonl`)
}

let migrated = false

// Before the file carried the exam, the one scores file was quiz/scores.jsonl and the quiz was
// Generative AI Leader's. The default exam takes that file over once, after copying it into
// scores-backups/. Another exam never touches it.
export function migrateLegacyScores(root: string): void {
  if (migrated || process.env.QUIZ_SCORES_FILE) return
  migrated = true
  if (examId(root) !== DEFAULT_EXAM) return
  const legacy = path.join(root, "quiz/scores.jsonl")
  const target = scoresFile(root)
  if (!existsSync(legacy) || existsSync(target)) return
  const backups = path.join(root, "quiz", BACKUP_DIR)
  mkdirSync(backups, { recursive: true })
  copyFileSync(legacy, path.join(backups, `scores-${DEFAULT_EXAM}-before-exam-names.jsonl`))
  renameSync(legacy, target)
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
    const dir = packDir(repoRoot())
    const glossary = path.join(dir, "glossary.md")
    const scenes = path.join(dir, "scenes.json")
    // A pack file missing mid-checkout is a 404 for the clip, not a crash.
    if (!existsSync(glossary) || !existsSync(scenes)) return null
    const stamp = `${dir}:${statSync(glossary).mtimeMs}:${statSync(scenes).mtimeMs}`
    if (voiceCache?.stamp === stamp) return voiceCache.index
    const parsed = parseGlossary(readFileSync(glossary, "utf8"))
    if (!parsed.ok) return null
    voiceCache = { stamp, index: voiceIndex(itemsFromGlossary(parsed.glossary, loadPack(repoRoot()).scenes)) }
    return voiceCache.index
  } catch {
    return null
  }
}
