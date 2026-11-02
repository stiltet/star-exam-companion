import { assignSessions, type ScoreLine } from "./learn.ts"
import { COURSES } from "./reading.ts"

export const MODES = ["round", "practice", "exam", "flashcard", "reading"] as const
export type Mode = (typeof MODES)[number]

// What the device saves for one answer, one finished exam or one flashcard mark.
// An exam saved since 27 Oct also keeps the option chosen per answered question and the
// questions flagged, so it can be reviewed later. retake: a retake of missed and flagged questions,
// reviewable but not counted as a practice exam.
export type Answer = { id: string; at: string; mode: Mode; asked: string[]; missed: string[]; seconds?: number; answers?: Record<string, number>; flagged?: string[]; retake?: true }

export const MAX_BATCH = 500
// The Practice exam's length comes from the exam pack (pack.json "exam"), as the real exam's does.
// The default is Generative AI Leader's, for a caller that names none.
export type ExamLength = { questions: number; minutes: number }
export const DEFAULT_EXAM_LENGTH: ExamLength = { questions: 60, minutes: 90 }
export const examSeconds = (length: ExamLength): number => length.minutes * 60
// An answer is at most this far ahead of the Mac's clock, or this far behind it.
const CLOCK_SKEW_MS = 10 * 60 * 1000
const OLDEST_MS = 400 * 24 * 60 * 60 * 1000
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
const READING = new RegExp(`^(${COURSES.map((course) => course.id).join("|")})/[0-9a-f]{24}$`)

// One answer from a batch, or null. Round and practice ask a question, flashcard a glossary term,
// one per line; an exam lists its questions and the seconds it took.
type KnownAnswers = { bankIds: ReadonlySet<string>; roundIds?: ReadonlySet<string>; termNames: ReadonlySet<string>; examLength?: ExamLength }

function inspectAnswer(value: unknown, known: KnownAnswers, now: number): Answer | string {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "The saved answer is not an object."
  const line = value as Record<string, unknown>
  const { id, at, mode, asked, missed, seconds, answers, flagged, retake } = line
  const allowed = mode === "exam" ? ["id", "at", "mode", "asked", "missed", "seconds", "answers", "flagged", "retake"] : ["id", "at", "mode", "asked", "missed"]
  if (Object.keys(line).some((key) => !allowed.includes(key))) return "The saved answer has unexpected fields."
  if (typeof id !== "string" || !UUID.test(id)) return "The saved answer has an invalid identifier."
  if (typeof at !== "string" || !ISO.test(at)) return "The saved answer has an invalid UTC timestamp."
  const t = Date.parse(at)
  if (Number.isNaN(t) || new Date(t).toISOString() !== at) return "The saved answer has an invalid UTC timestamp."
  if (t > now + CLOCK_SKEW_MS) return "The answer is ahead of the Mac's clock. Check the device time, then retry."
  if (t < now - OLDEST_MS) return "The answer is more than 400 days old."
  if (typeof mode !== "string" || !(MODES as readonly string[]).includes(mode)) return "The saved answer has an unknown quiz mode."
  if (!Array.isArray(asked) || !Array.isArray(missed)) return "The saved question lists are invalid."
  // A reading read in Read Aloud: "<course>/<page>", a page id as Google's bundle gives it. It is
  // never missed. The page itself is not checked against Google's bundle, which may be offline.
  if (mode === "reading") {
    if (asked.length !== 1 || missed.length !== 0) return "A reading is saved one at a time and is never missed."
    if (!asked.every((item) => typeof item === "string" && READING.test(item))) return "The reading is not a known course's page."
    return { id, at, mode, asked: asked as string[], missed: [] }
  }
  const pool = mode === "flashcard" ? known.termNames : mode === "round" ? known.roundIds ?? known.bankIds : known.bankIds
  if (!asked.every((item) => typeof item === "string" && pool.has(item))) return NOT_IN_BANK
  if (!missed.every((item) => typeof item === "string" && asked.includes(item))) return "A missed question is not in the saved answer's question list."
  if (new Set(asked).size !== asked.length || new Set(missed).size !== missed.length) return "The saved question lists contain duplicates."
  if (mode === "exam") {
    const length = known.examLength ?? DEFAULT_EXAM_LENGTH
    if (asked.length < 1 || asked.length > length.questions) return `An exam must contain 1 to ${length.questions} questions.`
    if (typeof seconds !== "number" || !Number.isInteger(seconds) || seconds < 0 || seconds > examSeconds(length)) return `The exam duration must be between 0 and ${examSeconds(length)} whole seconds.`
    const review = examReview(asked as string[], missed as string[], answers, flagged)
    if (typeof review === "string") return review
    if (retake !== undefined && retake !== true) return "Only true marks an exam as a retake."
    return { id, at, mode, asked: asked as string[], missed: missed as string[], seconds, ...review, ...(retake ? { retake } : {}) }
  }
  if (asked.length !== 1) return "This mode saves one question per answer."
  return { id, at, mode: mode as Mode, asked: asked as string[], missed: missed as string[] }
}

// The answers and flags of an exam, each about a question it asked. Both are optional.
function examReview(asked: string[], missed: string[], answers: unknown, flagged: unknown): { answers?: Record<string, number>; flagged?: string[] } | string {
  const review: { answers?: Record<string, number>; flagged?: string[] } = {}
  if (answers !== undefined) {
    if (!answers || typeof answers !== "object" || Array.isArray(answers)) return "The exam's answers are invalid."
    const entries = Object.entries(answers as Record<string, unknown>)
    if (!entries.every(([question, option]) => asked.includes(question) && typeof option === "number" && Number.isInteger(option) && option >= 0 && option < 10)) return "An exam answer is not a chosen option of a question it asked."
    review.answers = Object.fromEntries(entries) as Record<string, number>
    if (!asked.every((question) => question in (review.answers ?? {}) || missed.includes(question))) return "An unanswered exam question is not counted as missed."
  }
  if (flagged !== undefined) {
    if (!Array.isArray(flagged) || !flagged.every((question) => typeof question === "string" && asked.includes(question))) return "A flag is not on a question the exam asked."
    if (new Set(flagged).size !== flagged.length) return "The exam's flags contain duplicates."
    review.flagged = flagged as string[]
  }
  return review
}

// A question that was removed from the bank after the answer was queued on a device. It never
// comes back, so the device drops that answer instead of retrying it for ever.
export const NOT_IN_BANK = "A question or term is not in this mode's current question bank."

// Gone only when no question or term the answer names is known to any mode's pool: a removed
// question. One a narrower pool lacks, such as a round that offers fewer items than the bank, is
// refused and kept, as before.
function removedEverywhere(value: unknown, known: { bankIds: ReadonlySet<string>; roundIds?: ReadonlySet<string>; termNames: ReadonlySet<string> }): boolean {
  const asked = (value as { asked?: unknown } | null)?.asked
  if (!Array.isArray(asked)) return false
  return asked.some((item) => typeof item === "string" && !known.bankIds.has(item) && !known.roundIds?.has(item) && !known.termNames.has(item))
}

export function acceptAnswer(value: unknown, known: KnownAnswers, now: number): Answer | null {
  const result = inspectAnswer(value, known, now)
  return typeof result === "string" ? null : result
}

// A same-origin JSON { answers: [...] }. A malformed answer is rejected by id; the rest still count.
export function acceptBatch(input: {
  origin: string | null
  contentType: string | null
  body: unknown
  allowedOrigin: string
  bankIds: ReadonlySet<string>
  roundIds?: ReadonlySet<string>
  termNames: ReadonlySet<string>
  examLength?: ExamLength
  now: number
}): { ok: true; answers: Answer[]; rejected: string[]; gone: string[]; reasons: Record<string, string> } | { ok: false } {
  if (input.origin !== input.allowedOrigin) return { ok: false }
  if (input.contentType !== "application/json") return { ok: false }
  if (!input.body || typeof input.body !== "object" || Array.isArray(input.body)) return { ok: false }
  const body = input.body as Record<string, unknown>
  if (Object.keys(body).length !== 1 || !Array.isArray(body.answers)) return { ok: false }
  if (body.answers.length < 1 || body.answers.length > MAX_BATCH) return { ok: false }
  const answers: Answer[] = []
  const rejected: string[] = []
  const gone: string[] = []
  const reasons: Record<string, string> = {}
  for (const value of body.answers) {
    const answer = inspectAnswer(value, input, input.now)
    if (typeof answer !== "string") answers.push(answer)
    else {
      const id = (value as { id?: unknown } | null)?.id
      if (typeof id === "string" && UUID.test(id)) {
        rejected.push(id)
        if (answer === NOT_IN_BANK && removedEverywhere(value, input)) gone.push(id)
        reasons[id] = answer
      }
    }
  }
  return { ok: true, answers, rejected, gone, reasons }
}

export function toLine(answer: Answer, session: number): ScoreLine {
  return {
    date: answer.at.slice(0, 10),
    session,
    mode: answer.mode,
    asked: answer.asked,
    missed: answer.missed,
    ...(answer.seconds === undefined ? {} : { seconds: answer.seconds }),
    ...(answer.answers === undefined ? {} : { answers: answer.answers }),
    ...(answer.flagged === undefined ? {} : { flagged: answer.flagged }),
    ...(answer.retake ? { retake: true } : {}),
    id: answer.id,
    at: answer.at,
  }
}

// The lines to append for a batch: ids already saved are duplicates, each new answer is dated
// from its own time (UTC) and joins a session by the idle rule.
export function storeAnswers(existing: ScoreLine[], answers: Answer[]): { lines: ScoreLine[]; stored: string[]; duplicate: string[] } {
  const seen = new Set(existing.flatMap((line) => (line.id ? [line.id] : [])))
  const fresh: Answer[] = []
  const duplicate: string[] = []
  for (const answer of answers) {
    if (seen.has(answer.id)) duplicate.push(answer.id)
    else {
      seen.add(answer.id)
      fresh.push(answer)
    }
  }
  const sessions = assignSessions(existing, fresh)
  const lines = fresh.map((answer, index) => toLine(answer, sessions[index] ?? 0))
  return { lines, stored: fresh.map((answer) => answer.id), duplicate }
}

export const PAUSE_BEFORE_OPTIONS_MS = 1000
export const PAUSE_BETWEEN_OPTIONS_MS = PAUSE_BEFORE_OPTIONS_MS / 2
export const PAUSE_AFTER_LETTER_MS = 150

export function optionLetter(index: number): string {
  return String.fromCharCode(65 + index)
}

// What the voice says for a question, one clip each: the situation, then each option's letter and
// its name apart. Options are shuffled, so a name can land on any letter; separate clips keep one
// clip per name instead of one per name and letter.
export function questionClips(stem: string, options: string[]): { text: string; part: number; offset: number; pauseAfter: number }[] {
  const situation = stem.split("\n\n")[0] ?? stem
  return [
    { text: situation, part: 0, offset: 0, pauseAfter: PAUSE_BEFORE_OPTIONS_MS },
    ...options.flatMap((option, index) => [
      { text: `${optionLetter(index)}.`, part: index + 1, offset: 0, pauseAfter: PAUSE_AFTER_LETTER_MS },
      { text: option, part: index + 1, offset: 1, pauseAfter: index === options.length - 1 ? 0 : PAUSE_BETWEEN_OPTIONS_MS },
    ]),
  ]
}

export function answerAloud(correct: boolean, right = ""): string {
  if (correct) return right ? `Correct. ${right}.` : "Correct."
  return right ? `Incorrect. The answer is ${right}.` : "Incorrect."
}

export const PAUSE_IN_EXPLANATION_MS = PAUSE_BETWEEN_OPTIONS_MS

// What a wrong answer says, in order: the right answer, the "Why" heading, why it is right, and the binding constraint.
export function explanationParts(item: { options: string[]; correctIndex: number; why: string; constraint: string }): string[] {
  const right = item.options[item.correctIndex] ?? ""
  return [answerAloud(false, right), `Why ${right}.`, item.why, "Binding constraint.", item.constraint].filter((part) => part.trim() !== "")
}

// The same parts as shown, so the marked word uses the same words as the clip.
// The clip is spoken without the ** markers. The binding-constraint label is drawn
// with a colon; the clip says a full stop. Both are two words of the same length,
// so the mark stays on the word being said.
export function explanationShown(item: { options: string[]; correctIndex: number; why: string; constraint: string }): string[] {
  const right = (item.options[item.correctIndex] ?? "").replace(/\*\*/g, "")
  return [
    answerAloud(false, right),
    `Why ${right}.`,
    item.why.replace(/\*\*/g, ""),
    "Binding constraint.",
    item.constraint,
  ].filter((part) => part.trim() !== "")
}

export function discussText(input: { stem: string; options: string[]; yours: string; right: string; constraint: string }): string {
  const options = input.options.map((option, index) => `${String.fromCharCode(65 + index)}. ${option}`).join("\n")
  return [input.stem, options, `Your answer: ${input.yours}`, `Right answer: ${input.right}`].join("\n\n")
}

const NOVELTY = /bad news|bahh|bells|boing|bubbles|cellos|deranged|good news|hysterical|pipe organ|trinoids|whisper|zarvox|albert|fred|junior|kathy|ralph/i

function voiceRank(voice: { localService: boolean; lang: string; name?: string }): number {
  if (!voice.localService || NOVELTY.test(voice.name ?? "")) return 100
  let score = 50
  if (/premium|enhanced/i.test(voice.name ?? "")) score -= 40
  if (/eddy|flo/i.test(voice.name ?? "")) score -= 25
  if (voice.lang.startsWith("en-GB")) score -= 15
  else if (voice.lang.startsWith("en-")) score -= 5
  return score
}

export function localVoices<T extends { localService: boolean; lang: string; name?: string }>(voices: T[]): T[] {
  return voices.filter((voice) => voice.localService && !NOVELTY.test(voice.name ?? "")).sort((a, b) => voiceRank(a) - voiceRank(b))
}

// How the Mac's System voice should say an abbreviation, from the owner's listening test on
// 19 Oct. "AI" as written is right; spelling it "A I" was read wrong. Letters joined by hyphens
// are read as letters (M-L, C-E-O), and a plural takes 's (A-P-I's): "KPIs" as written was
// wrong. RAG and SAIF are said as words. ADK and FAQ were wrong in every spelling tried, so
// they are said in full. Speech only: the screen keeps the abbreviation.
const SPOKEN: Record<string, string> = {
  AI: "AI",
  RAG: "rag",
  SAIF: "safe",
  ADK: "Agent Development Kit",
  FAQ: "frequently asked questions",
}

// Words the owner heard said wrong in Read Aloud on 20 Oct, respelled the way A-P-I's is.
// "AI's" was misread, so it is spelled like the other possessive abbreviations. The Voice Quiz
// says them the same way, by design: one spelling per word.
const RESPELLED: [RegExp, string][] = [
  [/\bAI['’]s\b/g, "A-I's"],
  [/\bVeo\b/g, "Vay-oh"],
  [/\b(cut)-(offs?)\b/gi, "$1$2"],
  // "continues" was misread by the voice (owner, 20 Oct): it is spelled the way it sounds.
  [/\b([Cc])ontinues\b/g, "$1ontin-yooz"],
  // "recipient(s)" was read with the brackets: it is said as the plural.
  [/\b([A-Za-z]+)\(s\)/g, "$1s"],
]

// A heading said on its own, such as "Performance", was misread without a full stop after it,
// so its clip gets one. Speech only: the screen keeps the heading as written.
export function saidHeading(text: string): string {
  return /[.?!:]$/.test(text) ? text : `${text}.`
}

export function speakable(text: string): string {
  const said = RESPELLED.reduce((line, [word, spelled]) => line.replace(word, spelled), text.replace(/\*\*/g, ""))
  return said.replace(/\b([A-Z]{2,})(s?)\b/g, (_, letters: string, plural: string) => {
    const said = SPOKEN[letters]
    // "frequently asked questions" is plural already, so "FAQs" adds nothing.
    if (said) return plural && !said.endsWith("s") ? `${said}s` : said
    const spelled = letters.split("").join("-")
    return plural ? `${spelled}'s` : spelled
  })
}

// Every line the Voice Quiz can say, as the page sends it: each question and its options, the
// hint, both verdicts and the whole explanation of a wrong answer.
export function spokenLines(items: { stem: string; options: string[]; correctIndex: number; why: string; constraint: string }[]): string[] {
  const lines = new Set<string>([speakable(answerAloud(true))])
  for (const item of items) {
    lines.add(speakable(answerAloud(true, item.options[item.correctIndex] ?? "")))
    for (const part of [...questionClips(item.stem, item.options).map((clip) => clip.text), item.constraint, ...explanationParts(item)]) lines.add(speakable(part))
  }
  return [...lines]
}
