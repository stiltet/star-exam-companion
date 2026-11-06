import type { Loaded } from "./course-text.ts"
import type { Pack } from "./pack.ts"

export type ReadingCompletion = {
  readable: number
  total: number
  unreadable: number
  notice?: string
}

export function readingCompletion(pack: Pick<Pack, "courses" | "noReading">, loaded: readonly Loaded[]): ReadingCompletion {
  const readable = pack.courses.reduce((count, _course, index) => {
    const result = loaded[index]
    return count + Number(result?.ok === true && result.pages.length > 0)
  }, 0)
  const total = pack.courses.length + pack.noReading.length
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
