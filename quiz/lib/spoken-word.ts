// The word the voice is saying now, estimated: macOS `say` gives no word timings, so a clip's
// duration is shared out over its words by length, with a little extra per word for the gap.

const GAP = 2

// Words with their trailing space and punctuation, so joining them gives the text back.
export function words(text: string): string[] {
  return text.match(/\s+|\S+\s*/g) ?? []
}

// Index into words(text) of the word at `time` seconds into a clip `duration` long, or -1.
export function spokenWord(text: string, time: number, duration: number): number {
  const list = words(text)
  if (list.length === 0 || !Number.isFinite(duration) || duration <= 0) return -1
  const weights = list.map((word) => (word.trim() ? word.trim().length + GAP : 0))
  const total = weights.reduce((sum, weight) => sum + weight, 0)
  const at = (Math.min(Math.max(time, 0), duration) / duration) * total
  let reached = 0
  let last = -1
  for (let index = 0; index < list.length; index += 1) {
    if (weights[index] === 0) continue
    last = index
    reached += weights[index] ?? 0
    if (at < reached) return index
  }
  return last
}

// The sentences of a text, each with the index in words(text) of its first word. Read Aloud
// speaks one clip per sentence, so the estimated word cannot drift past a full stop.
// Abbreviations such as "e.g." and initials such as "A." do not end a sentence.
export function sentences(text: string): { text: string; first: number }[] {
  const list = words(text)
  const out: { text: string; first: number }[] = []
  let start = 0
  list.forEach((word, index) => {
    const bare = word.trim()
    const ends = /[.?!]["”’)\]]*$/.test(bare) && !/^(e\.g|i\.e|etc|vs|approx|incl)\.$/i.test(bare) && !/^[A-Z]\.$/.test(bare)
    if (index === list.length - 1 || (ends && word !== bare)) {
      const said = list.slice(start, index + 1).join("").trim()
      if (said) out.push({ text: said, first: start })
      start = index + 1
    }
  })
  return out
}

// Clips no longer than `max` once said: a sentence whose spoken form is too long (acronyms are
// spelled out letter by letter) is cut at word boundaries, each piece keeping its first word's
// index, so the marked word still lines up.
export function fitClips(parts: { text: string; first: number }[], spokenLength: (text: string) => number, max: number): { text: string; first: number }[] {
  const out: { text: string; first: number }[] = []
  for (const part of parts) {
    if (spokenLength(part.text) <= max) {
      out.push(part)
      continue
    }
    const list = words(part.text)
    let start = 0
    for (let index = 0; index < list.length; index += 1) {
      const longer = list.slice(start, index + 1).join("").trim()
      if (index > start && spokenLength(longer) > max) {
        out.push({ text: list.slice(start, index).join("").trim(), first: part.first + start })
        start = index
      }
    }
    out.push({ text: list.slice(start).join("").trim(), first: part.first + start })
  }
  return out
}

// Words of a text marked with **…** for the exam-guide name, each saying whether it is bold.
export function markedWords(text: string): { text: string; bold: boolean }[] {
  let bold = false
  return words(text).map((word) => {
    const startsBold = bold || word.startsWith("**")
    const opens = (word.match(/\*\*/g) ?? []).length
    if (opens % 2 === 1) bold = !bold
    return { text: word.replace(/\*\*/g, ""), bold: startsBold }
  })
}

// A word's look, the same as Read aloud: bold while it is said, or underlined when it is already bold.
export function spokenClass(alreadyBold: boolean, said: boolean): string | undefined {
  if (alreadyBold) return said ? "font-bold underline decoration-2" : "font-bold"
  return said ? "font-bold" : undefined
}

// The space keeps every class except the underline, so only the line is removed.
function withoutUnderline(className: string): string | undefined {
  const rest = className
    .split(/\s+/)
    .filter((token) => token !== "underline" && !/^decoration-\d+$/.test(token))
    .join(" ")
  return rest || undefined
}

// How one word is drawn. An underline stops at the word: the space after it is a piece of its
// own, so the line does not run into the gap before the next word.
export function spokenPieces(text: string, className: string | undefined): { text: string; className?: string }[] {
  if (!className?.split(/\s+/).includes("underline")) return [{ text, className }]
  const spaceAt = text.search(/\s/)
  if (spaceAt <= 0) return [{ text, className }]
  const space: { text: string; className?: string } = { text: text.slice(spaceAt) }
  const kept = className ? withoutUnderline(className) : undefined
  if (kept) space.className = kept
  return [{ text: text.slice(0, spaceAt), className }, space]
}
