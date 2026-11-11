// A captured lesson page holds the lesson and the page around it: the skip link, step numbers, icon names that a font turns into
// pictures, and the buttons of the player. Read aloud, these are noise. This removes those lines and nothing else; the crawl applies
// it before it saves, and the reader applies it to what was saved earlier, so a lesson saved before this existed reads clean too.

// Whole lines of interface text, compared without case.
const INTERFACE_LINES = new Set([
  "skip to lesson",
  "skip to content",
  "click to flip",
  "flip",
  "proprietary + confidential",
  "show feedback",
  "take again",
  "submit",
  "reset",
  "start",
  "check",
  "(opens in a new tab)",
  "touch_app",
  "play_arrow",
])

// The few icon names that are one word. Icon fonts print their name as text when the font is not drawn.
const ONE_WORD_ICONS = new Set(["add", "remove", "close", "menu", "check_circle", "arrow_forward", "arrow_back"])

export function isNoiseLine(raw: string): boolean {
  const line = raw.trim()
  if (line === "") return true
  const lower = line.toLowerCase()
  if (INTERFACE_LINES.has(lower) || ONE_WORD_ICONS.has(lower)) return true
  // A step number, a bullet, a stray full stop or closing bracket: up to three of those characters and nothing else (code braces stay).
  if (/^[\d.•·)]{1,3}$/.test(line)) return true
  // A single letter, such as the A, B, C of a quiz option.
  if (/^\p{L}$/u.test(line)) return true
  // An icon name: lower case words joined by underscores.
  if (/^[a-z]+(?:_[a-z]+)+$/.test(line)) return true
  // A progress label such as "0% COMPLETE".
  if (/^\d{1,3}%\s+complete$/i.test(line)) return true
  return false
}

export function cleanLessonText(text: string): string {
  return text
    .split(/\r?\n/)
    .filter((line) => !isNoiseLine(line))
    .map((line) => line.trimEnd())
    .join("\n")
    .trim()
}
