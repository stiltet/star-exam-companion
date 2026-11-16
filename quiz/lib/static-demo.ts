// True only in the build published on GitHub Pages (scripts/build-pages.sh sets it). That build is
// plain static files with no server behind it, so every place that would call the server checks
// this first and does nothing. The local app never sets it, so it behaves exactly as before.
// The literal process.env name is needed: Next replaces it with the value when it builds.
export const STATIC_DEMO = process.env.NEXT_PUBLIC_QUIZ_STATIC === "1"

// Where the demo's setup instructions live.
export const SETUP_URL = "https://github.com/stiltet/star-exam-companion#full-local-setup"

// The sub-path the demo is served from, empty everywhere else. Next does not add it to a link or an
// icon path itself, so a server component that writes one reads it here.
export const BASE_PATH = process.env.QUIZ_BASE_PATH ?? ""

// The exams the demo was built for, so a reader can move between them: the site is plain files, so each
// exam is its own build, the default one at the root and every other at <root>/<exam id>/.
// scripts/build-pages.sh sets these; elsewhere they are empty.
export type DemoPack = { id: string; title: string; href: string; current: boolean }

export function demoPacks(packs: string, root: string, fallback: string, current: string): DemoPack[] {
  return packs.split(";").filter(Boolean).map((entry) => {
    const [id = "", ...title] = entry.split("=")
    return { id, title: title.join("=") || id, href: id === fallback ? `${root}/` : `${root}/${id}/`, current: id === current }
  })
}

export const DEMO_PACKS: DemoPack[] = demoPacks(
  process.env.NEXT_PUBLIC_DEMO_PACKS ?? "",
  process.env.NEXT_PUBLIC_DEMO_ROOT ?? "",
  process.env.NEXT_PUBLIC_DEMO_DEFAULT ?? "",
  process.env.NEXT_PUBLIC_DEMO_CURRENT ?? "",
)
