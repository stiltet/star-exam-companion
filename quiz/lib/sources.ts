export type Term = {
  term: string
  meaning: string
  guides: string[]
  source: string
  sourceUrl: string
}

export type Rename = { oldName: string; newName: string }

export type Glossary = {
  terms: Term[]
  renames: Rename[]
  // The name of each renamed product that Google's exam guide uses. From "**Exam guide:** Name." markers.
  examNames: string[]
  namesChecked: string | null
}

export type ParseResult = { ok: true; glossary: Glossary } | { ok: false; row: string; error: string }

const SOURCE_URLS: Record<string, string> = {
  SG: "https://services.google.com/fh/files/misc/generative_ai_leader_study_guide_english.pdf",
  EG: "https://services.google.com/fh/files/misc/generative_ai_leader_exam_guide_english.pdf",
  MLG: "https://developers.google.com/machine-learning/glossary/generative",
  IAM: "https://docs.cloud.google.com/iam/docs/overview",
  "IAM security": "https://docs.cloud.google.com/iam/docs/using-iam-securely",
  "NLP page": "https://cloud.google.com/learn/what-is-natural-language-processing",
  Course: "https://www.skills.google/course_templates/541",
  "Product page": "https://cloud.google.com/vertex-ai",
}

function sourceUrl(source: string): string {
  const link = source.match(/\((https?:\/\/[^)]+)\)/)
  if (link?.[1]) return link[1]
  const key = source.split(",")[0]?.trim() ?? ""
  return SOURCE_URLS[key] ?? ""
}

export function parseGlossary(markdown: string): ParseResult {
  const terms: Term[] = []
  const renames: Rename[] = []
  const examNames = new Set<string>()
  for (const line of markdown.split("\n")) {
    if (!line.startsWith("| ")) continue
    const cells = line.split("|").slice(1, -1).map((cell) => cell.trim())
    if (cells.length < 4) continue
    const [term, meaning, guide, source] = cells
    if (!term || term === "Term" || term.startsWith("---")) continue
    if (meaning.includes("**Renamed:**")) {
      const markers = [...meaning.matchAll(/\*\*Renamed:\*\*\s*([^*]+?)(?:\. |$)/g)]
      if (markers.length === 0) return { ok: false, row: term, error: "Renamed marker cannot be read" }
      for (const marker of markers) {
        const pair = /^(.+?) => (.+)$/.exec((marker[1] ?? "").trim().replace(/\.$/, ""))
        if (!pair?.[1] || !pair[2]) return { ok: false, row: term, error: "Renamed marker cannot be read" }
        renames.push({ oldName: pair[1].trim(), newName: pair[2].trim() })
      }
    }
    for (const marker of meaning.matchAll(/\*\*Exam guide:\*\*\s*([^*]+?)\.(?:\s|$)/g)) {
      if (marker[1]) examNames.add(marker[1].trim())
    }
    terms.push({
      term,
      meaning: meaning.replace(/\s*\*\*Renamed:\*\*.*$/g, "").trim(),
      guides: (guide ?? "").split(",").map((part) => part.trim()).filter((part) => part && part !== "—"),
      source: source ?? "",
      sourceUrl: sourceUrl(source ?? ""),
    })
  }
  const checked = markdown.match(/Names last checked: (\d{4}-\d{2}-\d{2})/)
  const seen = new Set<string>()
  return {
    ok: true,
    glossary: {
      terms,
      renames: renames.filter((pair) => {
        const key = `${pair.oldName} => ${pair.newName}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
      }),
      examNames: [...examNames],
      namesChecked: checked?.[1] ?? null,
    },
  }
}

export function displayTerm(glossary: Glossary, name: string): { primary: string; also: string | null } {
  const forward = glossary.renames.find((item) => item.oldName.toLowerCase() === name.toLowerCase())
  if (forward) return { primary: forward.oldName, also: forward.newName }
  const back = glossary.renames.find((item) => item.newName.toLowerCase() === name.toLowerCase())
  if (back) return { primary: back.newName, also: null }
  return { primary: name, also: null }
}

function pairOf(glossary: Glossary, name: string): Rename | undefined {
  const lower = name.toLowerCase()
  return glossary.renames.find((pair) => pair.oldName.toLowerCase() === lower || pair.newName.toLowerCase() === lower)
}

// Wraps the exam-guide name in ** so the page can show it in bold.
function marked(glossary: Glossary, name: string): string {
  return isExamName(glossary, name) ? `**${name}**` : name
}

function isExamName(glossary: Glossary, name: string): boolean {
  return glossary.examNames.some((exam) => exam.toLowerCase() === name.toLowerCase())
}

// The one name to learn for a renamed product: the exam guide's name when the guide uses
// either, else Google's newest name. The owner's rule, 19 Oct: exam guide first, then the
// newest Google name. Any other name is shown only as "also called".
export function preferredName(glossary: Glossary, name: string): string {
  const pair = pairOf(glossary, name)
  if (!pair) return name
  if (isExamName(glossary, pair.oldName)) return pair.oldName
  return pair.newName
}

// The pair's name that is not the one to learn.
function notPreferred(glossary: Glossary, pair: Rename): string {
  return preferredName(glossary, pair.oldName).toLowerCase() === pair.oldName.toLowerCase() ? pair.newName : pair.oldName
}

// Both names of a renamed product: the name to learn first, the other as "also called". A row
// for the other name keeps its own name first, so the glossary still reads as one row per name.
export function label(glossary: Glossary, name: string): string {
  const pair = pairOf(glossary, name)
  if (!pair) return name
  const isOld = pair.oldName.toLowerCase() === name.toLowerCase()
  const [own, other] = isOld ? [pair.oldName, pair.newName] : [pair.newName, pair.oldName]
  return `${marked(glossary, own)} (also called ${marked(glossary, other)})`
}

// The name to learn, then the other name, for a name that is not the one to learn.
function learnLabel(glossary: Glossary, name: string): string {
  const preferred = preferredName(glossary, name)
  return `${marked(glossary, preferred)} (also called ${name})`
}

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

// Words that belong to a product name, so a shorter alias is not taken from the end of a longer one.
function nameWords(glossary: Glossary): Set<string> {
  const words = new Set<string>()
  const names = [...glossary.terms.map((term) => term.term), ...glossary.renames.flatMap((pair) => [pair.oldName, pair.newName])]
  for (const name of names) for (const word of name.split(/\s+/)) if (word) words.add(word)
  return words
}

// True when the match continues a longer product name, as "Model Registry" does at the end of
// "Vertex AI Model Registry" and "Agent Platform Model Registry".
function properNameTail(text: string, at: number, words: Set<string>): boolean {
  if (at < 2 || text[at - 1] !== " ") return false
  let start = at - 1
  while (start > 0 && text[start - 1] !== " ") start -= 1
  return words.has(text.slice(start, at - 1))
}

// Swaps each name that is not the one to learn for "<name to learn> (also called <name>)" in
// running text, in one pass so "Vertex AI Search" is not also read as "Vertex AI". Skips names
// the text already pairs, such as "formerly Vertex AI", "also called Cloud Run functions" or
// "Agent Search (now ...)", and leaves quoted Google wording as it is.
// What applyNames needs from a glossary, built once per glossary: Practice renames every written
// question's text, about a thousand calls a page, and rebuilding this each time took most of a
// second (28 Oct).
const namePreps = new WeakMap<Glossary, { other: Set<string>; words: Set<string>; pattern: RegExp } | null>()

function namePrep(glossary: Glossary) {
  if (namePreps.has(glossary)) return namePreps.get(glossary) ?? null
  const others = [...new Set(glossary.renames.map((pair) => notPreferred(glossary, pair)))]
  if (others.length === 0) {
    namePreps.set(glossary, null)
    return null
  }
  const other = new Set(others.map((name) => name.toLowerCase()))
  const shields = [...glossary.terms.map((term) => term.term), ...glossary.renames.flatMap((pair) => [pair.oldName, pair.newName])]
    .filter((name) => !other.has(name.toLowerCase()) && others.some((alias) => new RegExp(`\\b${escape(alias)}\\b`, "i").test(name)))
  const unique = [...new Set([...shields, ...others])].sort((a, b) => b.length - a.length)
  const words = nameWords(glossary)
  const pattern = new RegExp(
    `(?<!(?:[Ff]ormerly|[Aa]lso called|[Nn]ow called|[Nn]ow) (?:called )?)\\b(${unique.map(escape).join("|")})\\b(?! is now| \\((?:now|formerly|also called))`,
    "g",
  )
  const prep = { other, words, pattern }
  namePreps.set(glossary, prep)
  return prep
}

export function applyNames(glossary: Glossary, text: string): string {
  const prep = namePrep(glossary)
  if (!prep) return text
  const { other, words, pattern } = prep
  return text
    .split('"')
    .map((part, index) => (index % 2 === 1 ? part : part.replace(pattern, (name, _group, at: number) => (
      other.has(name.toLowerCase()) && !properNameTail(part, at, words) ? learnLabel(glossary, name) : name
    ))))
    .join('"')
}

// Removes the bold markers, for speech and plain text.
export function plainNames(text: string): string {
  return text.replace(/\*\*/g, "")
}
