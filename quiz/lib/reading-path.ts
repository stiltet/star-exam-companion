// The logic behind `pnpm --dir quiz reading:path`: turning what a Google Skills learning-path page lists into the courses an exam
// exam needs. The command (scripts/reading-path.mts) holds the browser; nothing here touches one.

// A card as the learning-path page lists it.
export type PathCard = { type: string; title: string; href: string }

// A course entry of an exam's courses.json. Its number is its place in Google's order, and every course is captured by the
// crawl, so it is private.
export type PathCourse = { id: string; template: string; title: string; provider: "private" }

// The public Google Cloud Storage folder an exam names for its public courses. An exam that captures every course never reads
// it, but the exam format asks for it.
export const BUNDLE_BASE = "https://storage.googleapis.com/cloud-training/cls-html5-courses"

// The address of a learning path from what the user gave: the whole address, or just its number. Null when it is neither.
export function pathAddress(input: string, site: string): string | null {
  const text = input.trim()
  if (/^\d+$/.test(text)) return `${site}/paths/${text}`
  let url: URL
  try {
    url = new URL(text)
  } catch {
    return null
  }
  const base = new URL(site)
  if (url.host !== base.host || !/^\/paths\/\d+\/?$/.test(url.pathname)) return null
  return `${site}${url.pathname.replace(/\/$/, "")}`
}

// The courses of the path in the order the page lists them. Cards that are not courses (a credential, a survey) are left out, and
// a course the page lists twice counts once.
export function pathCourses(cards: PathCard[]): PathCourse[] {
  const seen = new Set<string>()
  const courses: PathCourse[] = []
  for (const card of cards) {
    if (card.type !== "course") continue
    const match = /\/course_templates\/(\d+)/.exec(card.href)
    const title = card.title.trim()
    if (!match || title === "" || seen.has(match[1])) continue
    seen.add(match[1])
    courses.push({ id: String(courses.length + 1), template: match[1], title, provider: "private" })
  }
  return courses
}

// The content of an exam's courses.json for this path.
export function coursesFile(address: string, courses: PathCourse[]): { path: string; bundleBase: string; courses: PathCourse[] } {
  return { path: address, bundleBase: BUNDLE_BASE, courses }
}
