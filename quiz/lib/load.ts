import { existsSync, readFileSync, statSync } from "node:fs"
import path from "node:path"
import { chronological, parseScoreLines, parseSections, parseWeights } from "./learn.ts"
import { itemsFromGlossary } from "./round.ts"
import { parseGlossary } from "./sources.ts"
import { voiceIndex } from "./speak.ts"

function repoRoot(): string {
  return path.resolve(process.cwd(), "..")
}

// QUIZ_SCORES_FILE points a test instance at a scratch file, so a test never writes real scores.
export function scoresFile(root: string): string {
  return process.env.QUIZ_SCORES_FILE || path.join(root, "quiz/scores.jsonl")
}

export function readScores(file: string) {
  return existsSync(file) ? parseScoreLines(readFileSync(file, "utf8")) : { lines: [], skipped: 0 }
}

export function loadPlay() {
  const root = repoRoot()
  const parsed = parseGlossary(readFileSync(path.join(root, "glossary.md"), "utf8"))
  if (!parsed.ok) return parsed
  const plan = readFileSync(path.join(root, "exam-sections.md"), "utf8")
  const { lines, skipped } = readScores(scoresFile(root))
  return {
    ok: true as const,
    glossary: parsed.glossary,
    items: itemsFromGlossary(parsed.glossary),
    weights: parseWeights(plan),
    sections: parseSections(plan),
    lines: chronological(lines),
    skippedLines: skipped,
    root,
  }
}

// The quiz's spoken lines come from the glossary, so their keys change only when it does. Each clip
// request reads this, so it is rebuilt only when glossary.md's modification time moves.
let voiceCache: { stamp: number; index: Map<string, string> } | null = null

export function loadVoiceIndex(): Map<string, string> | null {
  const file = path.join(repoRoot(), "glossary.md")
  // A glossary missing mid-checkout is a 404 for the clip, not a crash.
  if (!existsSync(file)) return null
  const stamp = statSync(file).mtimeMs
  if (voiceCache?.stamp === stamp) return voiceCache.index
  const parsed = parseGlossary(readFileSync(file, "utf8"))
  if (!parsed.ok) return null
  voiceCache = { stamp, index: voiceIndex(itemsFromGlossary(parsed.glossary)) }
  return voiceCache.index
}
