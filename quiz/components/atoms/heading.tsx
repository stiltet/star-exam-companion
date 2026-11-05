import type { ReactNode, Ref } from "react"

// The quiz's heading atom. section: the "Next" title over the next reading. It is
// larger than a reading heading and centred (owner, 21 Oct). group: the Voice Quiz's exam-section
// name, centred between the previous and next arrows. chapter: the "Question N of M" line.
// title: a reading's own title. page: a page's heading. title and page are h1s.
// label: a small bold heading over a box or list, such as RULES or QUESTIONS on the exam.
// rule: a home page section title with a rule under it, such as DESCRIPTION or EXAM STRUCTURE.
// hero: the home page's course title, the Google Cloud logo over the course name on a phone
// and beside it from md up (owner, 28 Oct). It grows from a phone so GENERATIVE AI LEADER
// stays on one line at 375 px. HeroTitle sizes any course name to stay on one line: the size is
// capped at the hero's own, and shrinks when the name is too long for the room it has.
// Its look lives here; the parent places it. id lets a region be named by it. A ref makes it
// a place focus can be moved to.
export type HeadingVariant = "section" | "group" | "chapter" | "title" | "page" | "label" | "rule" | "hero"

const LOOK: Record<HeadingVariant, string> = {
  section: "text-center text-3xl font-bold m-0 leading-none",
  group: "text-center font-bold m-0",
  chapter: "text-lg font-bold m-0",
  title: "text-[28px] font-bold m-0",
  page: "text-2xl font-bold m-0",
  label: "text-base font-bold m-0",
  rule: "text-xl font-bold border-b-2 border-foreground pb-2 m-0",
  // The heading is the container HeroTitle measures. --hero-max is the largest size; --hero-reserve is
  // the room the logo takes beside the title from md up.
  hero: "flex flex-col items-start md:flex-row md:items-center md:gap-6 text-xl sm:text-3xl font-bold leading-tight m-0 [container-type:inline-size] [--hero-max:1.25rem] sm:[--hero-max:1.875rem] md:[--hero-reserve:290px]",
}

// A paragraph heading in the reading's play list. It is a button, not a heading element.
// first: the reading's title when it is the first line. other: a section heading under it.
export const PARAGRAPH_HEADING = {
  first: "text-[28px] font-bold",
  other: "text-xl font-bold",
}

// The hero's course name, on one line at every width. A monospace letter is about 0.6 em wide, so
// the size that fits is the room divided by the letters; 0.62 leaves a little to spare.
export function HeroTitle({ children }: { children: string }) {
  return (
    <span className="block whitespace-nowrap" style={{ fontSize: `min(var(--hero-max), calc((100cqw - var(--hero-reserve, 0px)) / ${(children.length * 0.62).toFixed(2)}))` }}>
      {children}
    </span>
  )
}

export function Heading({ variant, id, placement, ref, children }: { variant: HeadingVariant; id?: string; placement?: string; ref?: Ref<HTMLHeadingElement>; children: ReactNode }) {
  const Tag = variant === "title" || variant === "page" ? "h1" : "h2"
  return (
    <Tag id={id} ref={ref} tabIndex={ref ? -1 : undefined} className={[LOOK[variant], placement].filter(Boolean).join(" ")}>
      {children}
    </Tag>
  )
}
