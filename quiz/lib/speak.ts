import { createHash } from "node:crypto"
import type { RoundItem } from "./learn.ts"
import { spokenLines } from "./score.ts"
import { MAX_SPEAK_CHARS } from "./speak-limit.ts"

export { MAX_SPEAK_CHARS }

// `say` reads [[...]] as embedded commands (volume, rate, voice), so none reach it from a request.
// Whole commands go first; any [[ left over, such as "[[rate 500]x]]", is broken up too.
export function normaliseSpeech(text: string): string {
  return text.replace(/\[\[[^\]]*\]\]/g, " ").replace(/\[\[/g, "[ [").replace(/\s+/g, " ").trim()
}

// The text to speak, or null when the request is not a same-origin JSON { text } of sensible length.
export function acceptSpeak(input: { origin: string | null; contentType: string | null; body: unknown; allowedOrigin: string }): string | null {
  if (input.origin !== input.allowedOrigin) return null
  if (input.contentType !== "application/json") return null
  if (!input.body || typeof input.body !== "object" || Array.isArray(input.body)) return null
  const body = input.body as Record<string, unknown>
  if (Object.keys(body).length !== 1 || typeof body.text !== "string") return null
  const text = normaliseSpeech(body.text)
  if (text.length === 0 || text.length > MAX_SPEAK_CHARS) return null
  return text
}

// Room for every line the quiz can say, several times over, so storing them for offline use
// never evicts one. Each is a few hundred KB.
export const MAX_CACHED_CLIPS = 4000

// Read Aloud's own pool: about one course read through, one clip per sentence. A separate cap,
// so reading the courses never evicts the Voice Quiz's clips.
export const MAX_READING_CLIPS = 1500

// Which cached clips to delete, oldest first, so that at most `keep` remain.
export function clipsToEvict(clips: { name: string; mtimeMs: number }[], keep = MAX_CACHED_CLIPS): string[] {
  if (clips.length <= keep) return []
  return [...clips].sort((a, b) => a.mtimeMs - b.mtimeMs).slice(0, clips.length - keep).map((clip) => clip.name)
}

export function speechKey(text: string): string {
  return createHash("sha256").update(text).digest("hex")
}

export function speechFileName(text: string): string {
  return `${speechKey(text)}.wav`
}

// Each line the page sends, to the key of its clip: GET /api/speak/<key> speaks only these.
export function voiceKeys(items: RoundItem[]): Record<string, string> {
  const keys: Record<string, string> = {}
  for (const line of spokenLines(items)) {
    const text = normaliseSpeech(line)
    if (text.length > 0 && text.length <= MAX_SPEAK_CHARS) keys[line] = speechKey(text)
  }
  return keys
}

// Every key to the text it speaks. Built once per glossary (lib/load.ts caches it), so a phone
// downloading every clip costs one pass, not one per clip.
export function voiceIndex(items: RoundItem[]): Map<string, string> {
  const index = new Map<string, string>()
  for (const [line, key] of Object.entries(voiceKeys(items))) index.set(key, normaliseSpeech(line))
  return index
}

// The text for a key, or undefined for any key the quiz cannot say.
export function voiceText(items: RoundItem[], key: string): string | undefined {
  return voiceIndex(items).get(key)
}
