import type { Loaded } from "./course-text.ts"
import type { Pack } from "./pack.ts"

export type ReadingCompletion = {
  readable: number
  total: number
  unreadable: number
  notice?: string
}

export function readingCompletion(pack: Pick<Pack, "courses">, loaded: readonly Loaded[]): ReadingCompletion {
  const readable = pack.courses.reduce((count, _course, index) => {
    const result = loaded[index]
    return count + Number(result?.ok === true && result.pages.length > 0)
  }, 0)
  // Courses with no reading text on Google Skills are listed apart and can never be read, so they do not keep this notice up:
  // it clears once every course that can have text is readable here.
  const total = pack.courses.length
  const unreadable = total - readable
  return {
    readable,
    total,
    unreadable,
    ...(unreadable > 0
      ? { notice: `Unfinished: Read Aloud can read ${readable} of ${total} courses on this server; ${unreadable} ${unreadable === 1 ? "course needs" : "courses need"} reading text.` }
      : {}),
  }
}
