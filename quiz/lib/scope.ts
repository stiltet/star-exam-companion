// What one exam keeps in the browser (queued answers, the saved snapshot, a half-finished exam)
// is named per exam, so switching an install to another exam on the same address never sends one
// exam's answers to another. The default exam keeps the plain names, so an install that studied
// before exam packs loses nothing. Client-safe: no Node imports.

export const DEFAULT_EXAM = "generative-ai-leader"

// Baked in at build time from QUIZ_EXAM (next.config.mjs), since the browser cannot read the server's environment.
export const BUILT_EXAM = process.env.NEXT_PUBLIC_QUIZ_EXAM || DEFAULT_EXAM

// Whether this exam's pack has the course reading feature (pack.json "reading"), also baked in at build time.
export const BUILT_READING = process.env.NEXT_PUBLIC_QUIZ_READING !== "0"

export function scoped(name: string, exam: string = BUILT_EXAM): string {
  return exam === DEFAULT_EXAM ? name : `${name}-${exam}`
}
