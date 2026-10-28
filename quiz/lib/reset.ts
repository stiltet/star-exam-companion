import { constants, copyFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs"
import path from "node:path"

export const BACKUP_DIR = "scores-backups"

export function backupName(now: Date): string {
  return `scores-${now.toISOString().replace(/[:.]/g, "-")}.jsonl`
}

export function acceptReset(input: { origin: string | null; contentType: string | null; body: unknown; allowedOrigin: string }): boolean {
  if (input.origin !== input.allowedOrigin) return false
  if (input.contentType !== "application/json") return false
  if (!input.body || typeof input.body !== "object" || Array.isArray(input.body)) return false
  const body = input.body as Record<string, unknown>
  return Object.keys(body).length === 1 && body.confirm === true
}

// Copies the scores file into scores-backups/ beside it first, then empties it. Returns the backup path.
export function resetScores(scores: string, now: Date): string | null {
  const quizDir = path.dirname(scores)
  let backup: string | null = null
  if (existsSync(scores)) {
    mkdirSync(path.join(quizDir, BACKUP_DIR), { recursive: true })
    // Two resets in one millisecond share a name; the second takes the next free suffix.
    const base = backupName(now).replace(/\.jsonl$/, "")
    for (let n = 0; ; n += 1) {
      backup = path.join(quizDir, BACKUP_DIR, n === 0 ? `${base}.jsonl` : `${base}-${n}.jsonl`)
      if (!existsSync(backup)) break
    }
    copyFileSync(scores, backup, constants.COPYFILE_EXCL)
  }
  writeFileSync(scores, "")
  return backup
}
