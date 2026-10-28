import type { ReactNode, Ref } from "react"

// The quiz's heading atom. section: the "Next" title over the next reading. It is
// larger than a reading heading and centred (owner, 21 Oct). group: the Voice Quiz's exam-section
// name, centred between the previous and next arrows. chapter: the "Question N of M" line.
// title: a reading's own title. page: a page's heading. title and page are h1s.
// label: a small bold heading over a box or list, such as RULES or QUESTIONS on the exam.
// hero: the home page's course title, the Google Cloud logo over the course name on a phone
// and beside it from md up (owner, 28 Oct). It grows from a phone so GENERATIVE AI LEADER
// stays on one line at 375 px.
// Its look lives here; the parent places it. id lets a region be named by it. A ref makes it
// a place focus can be moved to.
export type HeadingVariant = "section" | "group" | "chapter" | "title" | "page" | "label" | "hero"

const LOOK: Record<HeadingVariant, string> = {
  section: "text-center text-3xl font-bold m-0 leading-none",
  group: "text-center font-bold m-0",
  chapter: "text-lg font-bold m-0",
  title: "text-[28px] font-bold m-0",
  page: "text-2xl font-bold m-0",
  label: "text-base font-bold m-0",
  hero: "flex flex-col items-start md:flex-row md:items-center md:gap-6 text-xl sm:text-3xl font-bold leading-tight m-0",
}

// A paragraph heading in the reading's play list. It is a button, not a heading element.
// first: the reading's title when it is the first line. other: a section heading under it.
export const PARAGRAPH_HEADING = {
  first: "text-[28px] font-bold",
  other: "text-xl font-bold",
}

export function Heading({ variant, id, placement, ref, children }: { variant: HeadingVariant; id?: string; placement?: string; ref?: Ref<HTMLHeadingElement>; children: ReactNode }) {
  const Tag = variant === "title" || variant === "page" ? "h1" : "h2"
  return (
    <Tag id={id} ref={ref} tabIndex={ref ? -1 : undefined} className={[LOOK[variant], placement].filter(Boolean).join(" ")}>
      {children}
    </Tag>
  )
}
