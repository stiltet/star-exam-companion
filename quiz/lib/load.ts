import { existsSync, readFileSync, statSync } from "node:fs"
import path from "node:path"
import { chronological, parseScoreLines, parseSections, parseWeights } from "./learn.ts"
import { DEFAULT_EXAM, examId, loadPack, packDir, repoRoot } from "./pack.ts"
import { itemsFromGlossary } from "./round.ts"
import { parseGlossary } from "./sources.ts"
import { voiceIndex } from "./speak.ts"

// Each exam keeps its own scores file, so two installs never mix answers. The default exam keeps
// quiz/scores.jsonl, where an install that studied before exam packs already has its answers.
// QUIZ_SCORES_FILE points a test instance at a scratch file, so a test never writes real scores.
export function scoresFile(root: string, id: string = examId()): string {
  return process.env.QUIZ_SCORES_FILE || path.join(root, "quiz", id === DEFAULT_EXAM ? "scores.jsonl" : `scores-${id}.jsonl`)
}

export function readScores(file: string) {
  return existsSync(file) ? parseScoreLines(readFileSync(file, "utf8")) : { lines: [], skipped: 0 }
}

export function loadPlay() {
  const root = repoRoot()
  const pack = loadPack(root)
  const parsed = parseGlossary(pack.glossaryText)
  if (!parsed.ok) return parsed
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
