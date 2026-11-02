// The quiz's pages, in menu order. The header, the home navigation and the missing-page
// list all read this, so a page cannot be in one of them and absent from the others.

export type SitePage = {
  href: string
  menu: string
  title: string
  blurb: string
  // The header's title, when it differs from the page list's title.
  phone?: string
}

const ALL_PAGES: readonly SitePage[] = [
  { href: "/study", menu: "STUDY", title: "Study Sections", blurb: "Topic-by-topic breakdown with exam focus" },
  { href: "/practice", menu: "PRACTICE", title: "Practice Questions", blurb: "Individual questions with explanations" },
  { href: "/voice", menu: "VOICE QUIZ", title: "Voice Quiz", blurb: "Voice Quiz. An exam question, read aloud" },
  { href: "/read", menu: "READ ALOUD", title: "Read Aloud", blurb: "The official learning path, read aloud" },
  { href: "/exam", menu: "EXAM", title: "Practice Exam", blurb: "Timed practice exam" },
  { href: "/flashcards", menu: "FLASHCARDS", title: "Flashcards", blurb: "Term recall from official terminology" },
  { href: "/glossary", menu: "GLOSSARY", title: "Glossary", blurb: "All terms linked and categorized" },
  { href: "/progress", menu: "PROGRESS", title: "Progress", blurb: "Track completion and weak areas" },
]

// The pages of the exam this install serves: an exam pack with no course to read has no Read Aloud
// page, and the Practice exam's blurb gives that exam's length.
export function sitePages(pack: { reading: boolean; exam: { questions: number; minutes: number } }): readonly SitePage[] {
  return ALL_PAGES.filter((page) => pack.reading || page.href !== "/read").map((page) =>
    page.href === "/exam" ? { ...page, blurb: `Timed practice exam (${pack.exam.minutes} min, ${pack.exam.questions} questions)` } : page,
  )
}

// Pages outside the menu that still have their own phone title.
const OTHER_TITLES: Record<string, string> = {
  "/read/night": "Night reading",
  "/about": "About",
}

// The header carries the page title at every width. Nested pages keep their own h1, so the header
// names only the section.
export function phoneTitle(pathname: string): string {
  const page = ALL_PAGES.find((entry) => entry.href === pathname)
  if (page) return page.phone ?? page.title
  if (OTHER_TITLES[pathname]) return OTHER_TITLES[pathname]
  if (pathname.startsWith("/study/")) return "Study"
  if (pathname.startsWith("/read/")) return "Read Aloud"
  return "Star Exam Companion"
}
