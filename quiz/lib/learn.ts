export type ScoreLine = {
  date: string
  session: number
  mode: string
  asked: string[]
  missed: string[]
  // Exam lines only: the seconds the exam took.
  seconds?: number
  // Exam lines saved since 27 Oct: the option chosen per answered question, and the flagged ones.
  answers?: Record<string, number>
  flagged?: string[]
  // A retake of an exam's missed and flagged questions: reviewable, not a practice exam.
  retake?: boolean
  // Lines saved since 1 Oct 2026 carry their own id and the moment of the answer (ISO, UTC).
  id?: string
  at?: string
}

// Reads scores.jsonl one line at a time. A torn or hand-broken line is skipped and counted,
// so it costs that one answer, not the whole history.
export function parseScoreLines(text: string): { lines: ScoreLine[]; skipped: number } {
  const lines: ScoreLine[] = []
  let skipped = 0
  for (const raw of text.split("\n")) {
    if (!raw.trim()) continue
    try {
      const line = JSON.parse(raw) as Partial<ScoreLine>
      if (typeof line.session !== "number" || !Array.isArray(line.asked) || !Array.isArray(line.missed)) throw new Error("not a score line")
      lines.push(line as ScoreLine)
    } catch {
      // Counted and shown on the Progress page; the other lines still load.
      skipped += 1
    }
  }
  return { lines, skipped }
}

export type RoundItem = {
  id: string
  section: number
  // Learning-path course, "1" to "5". Absent on a copy saved before courses were stored.
  course?: string
  guideId: string
  stem: string
  options: string[]
  correctIndex: number
  constraint: string
  source: string
  // Why the right answer is right: its glossary.md meaning, and that row's Source cell.
  why: string
  whySource: string
}

/** A gap this long between answers starts a new session. */
export const IDLE_MS = 30 * 60 * 1000

// Lines in the order they were answered. A line sent late from the phone is appended late but
// sorts by its own time; older lines without a time keep their file order, before the timed ones.
export function chronological(lines: ScoreLine[]): ScoreLine[] {
  return [...lines].sort((a, b) => (a.at ?? "").localeCompare(b.at ?? ""))
}

// The session of each new answer, in input order. An answer within IDLE_MS of another joins that
// answer's session; any other opens one above every session so far. Mac and phone share this rule.
export function assignSessions(existing: ScoreLine[], incoming: { at: string }[]): number[] {
  let top = existing.reduce((max, line) => Math.max(max, line.session), 0)
  const timed = existing.filter((line) => line.at).map((line) => ({ t: Date.parse(line.at ?? ""), session: line.session }))
  const order = incoming.map((answer, index) => ({ index, t: Date.parse(answer.at) })).sort((a, b) => a.t - b.t)
  const sessions: number[] = new Array(incoming.length).fill(0)
  for (const { index, t } of order) {
    let nearest: { t: number; session: number } | undefined
    for (const other of timed) {
      const gap = Math.abs(other.t - t)
      if (gap <= IDLE_MS && (!nearest || gap < Math.abs(nearest.t - t))) nearest = other
    }
    const session = nearest ? nearest.session : ++top
    sessions[index] = session
    timed.push({ t, session })
  }
  return sessions
}

/** Practice bar for this app. Google does not publish a passing score. */
export const PRACTICE_TARGET = 100

/** Pass mark for a practice exam in this app (owner, 28 Oct). Google does not publish one. */
export const EXAM_TARGET = 90

/** Right answers in a row, after a miss, that retire a question. In any session. */
export const STREAK_TO_LEARN = 3

// Expects lines in chronological order. A question never missed is learned on its first right
// answer; a missed one after STREAK_TO_LEARN right answers in a row. A new miss resets the count.
export function isLearned(id: string, lines: ScoreLine[]): boolean {
  let everMissed = false
  let streak = 0
  for (const line of lines) {
    if (!line.asked.includes(id)) continue
    if (line.missed.includes(id)) {
      everMissed = true
      streak = 0
    } else {
      streak += 1
    }
  }
  return everMissed ? streak >= STREAK_TO_LEARN : streak > 0
}

export function voiceProgress(
  items: Pick<RoundItem, "id" | "section" | "course">[],
  lines: ScoreLine[],
  sections: { id: number; title: string; weight: number }[],
  belongs: (item: { section: number; course?: string }, sectionId: number) => boolean = (item, id) => item.section === id,
): { total: number; asked: number; correct: number; sections: { id: number; title: string; weight: number; total: number; asked: number; correct: number }[] } {
  const latest = new Map<string, boolean>()
  for (const line of lines) {
    for (const id of line.asked) latest.set(id, !line.missed.includes(id))
  }
  const rows = sections.map((section) => {
    const own = items.filter((item) => belongs(item, section.id))
    const asked = own.filter((item) => latest.has(item.id))
    return {
      id: section.id,
      title: section.title,
      weight: section.weight,
      total: own.length,
      asked: asked.length,
      correct: asked.filter((item) => latest.get(item.id)).length,
    }
  })
  return {
    total: items.length,
    asked: items.filter((item) => latest.has(item.id)).length,
    correct: items.filter((item) => latest.get(item.id) === true).length,
    sections: rows,
  }
}

export function sectionCleared(section: number, items: RoundItem[], lines: ScoreLine[]): boolean {
  const own = items.filter((item) => item.section === section)
  return own.length > 0 && own.every((item) => isLearned(item.id, lines))
}

export function parseWeights(plan: string): Record<number, number> {
  const weights: Record<number, number> = {}
  for (const section of parseSections(plan)) weights[section.id] = section.weight
  return weights
}

export function parseSections(plan: string): { id: number; title: string; weight: number }[] {
  return [...plan.matchAll(/Section (\d) \(([^,]+), ~(\d+)%\)/g)].map((match) => ({
    id: Number(match[1]),
    title: (match[2] ?? "").trim(),
    weight: Number(match[3]),
  }))
}
