import Link from "next/link"
import type { ComponentProps, ReactNode } from "react"

// The quiz's button atom. Its look lives here, once; a page passes only placement
// classes (self-stretch, margins), never size, spacing or colour.
// filled: an action that goes somewhere (the review on Google, the next reading).
// outlined: an action done here (MARK AS READ), or a link beside a filled one, such as PRACTICE
// EXAM beside START STUDYING on the home page. aria-disabled dims it and stops the hover.
// danger: an action that ends something, such as END EXAM.
// toggle: a small on/off control, such as a review filter; on (aria-pressed) is inverted.
// flag: the exam's FLAG control; on is the flag colour.
export type ButtonVariant = "filled" | "outlined" | "danger" | "control" | "toggle" | "flag"

// One line, unless wrap is set: a long label ends in an ellipsis rather than wrapping.
const BASE = "inline-flex max-w-full min-w-0 items-center justify-center gap-6 border-2 border-foreground px-4 py-3 text-base font-bold uppercase no-underline"

// The Voice Quiz controls, the same size as Back and Next rather than the large uppercase actions.
const CONTROL = "inline-flex max-w-full min-w-0 items-center gap-2 border-2 border-foreground bg-background px-4 py-2 text-base no-underline disabled:opacity-40"

// Small on/off controls, the size of the Voice Quiz controls. aria-pressed marks them on.
const TOGGLE = "inline-flex max-w-full min-w-0 items-center justify-center gap-2 border-2 border-foreground px-3 py-2 text-sm font-bold uppercase whitespace-nowrap no-underline disabled:opacity-40"

const TOGGLES: Record<"toggle" | "flag", string> = {
  toggle: "bg-background text-foreground hover:bg-muted aria-pressed:bg-foreground aria-pressed:text-background aria-pressed:hover:bg-foreground",
  flag: "bg-background text-foreground hover:bg-muted aria-pressed:bg-flag aria-pressed:text-flag-foreground aria-pressed:hover:bg-flag",
}

const VARIANTS: Record<"filled" | "outlined" | "danger", string> = {
  filled: "bg-foreground text-background hover:opacity-80",
  danger: "bg-danger text-danger-foreground hover:opacity-80",
  outlined:
    "bg-background text-foreground hover:bg-foreground hover:text-background aria-disabled:opacity-60 aria-disabled:cursor-default aria-disabled:hover:bg-background aria-disabled:hover:text-foreground",
}

export function buttonClass(variant: ButtonVariant, placement = "", wrap = false): string {
  if (variant === "control") return [CONTROL, placement].filter(Boolean).join(" ")
  if (variant === "toggle" || variant === "flag") return [TOGGLE, TOGGLES[variant], placement].filter(Boolean).join(" ")
  return [BASE, wrap ? "whitespace-normal" : "whitespace-nowrap", VARIANTS[variant], placement].filter(Boolean).join(" ")
}

type Placement = { variant: ButtonVariant; placement?: string }

// The label, cut with an ellipsis when it does not fit, its full text kept as a hover title; an
// arrow after it is never cut.
function ButtonText({ children, arrow, wrap }: { children: ReactNode; arrow?: boolean; wrap?: boolean }) {
  const parts = [children].flat()
  const text = parts.every((part) => typeof part === "string" || typeof part === "number") ? parts.join("") : undefined
  return (
    <>
      <span className={wrap ? "min-w-0 text-left" : "min-w-0 truncate"} title={text}>{children}</span>
      {arrow && <span className="shrink-0" aria-hidden="true">→</span>}
    </>
  )
}

// A link that looks like a button. An href starting with "/" stays in the app; any other goes out.
// arrow: it goes somewhere, shown by a → after the label.
// newTab: it opens in a new tab, shown by a ↗ in place of any arrow, and said to a screen reader.
// wrap: the label may use more than one line, for a name that does not fit a phone.
export function ActionLink({ variant, placement, href, arrow, newTab, wrap, children }: Placement & { href: string; arrow?: boolean; newTab?: boolean; wrap?: boolean; children: ReactNode }) {
  const className = buttonClass(variant, placement, wrap)
  const label = <ButtonText arrow={arrow && !newTab} wrap={wrap}>{children}</ButtonText>
  if (newTab) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
        {label}
        <span aria-hidden="true">↗</span>
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
    )
  }
  return href.startsWith("/") ? <Link href={href} className={className}>{label}</Link> : <a href={href} className={className}>{label}</a>
}

export function ActionButton({ variant, placement, wrap, children, ...props }: Placement & Omit<ComponentProps<"button">, "className"> & { wrap?: boolean }) {
  return (
    <button type="button" {...props} className={buttonClass(variant, placement, wrap)}>
      <ButtonText wrap={wrap}>{children}</ButtonText>
    </button>
  )
}

// A Voice Quiz control. iconEnd puts the arrow after the word, as Next does.
export function ControlButton({ icon, iconEnd = false, children, ...props }: { icon?: ReactNode; iconEnd?: boolean } & Omit<ComponentProps<"button">, "className">) {
  return (
    <button type="button" {...props} className={buttonClass("control")}>
      {!iconEnd && icon}
      {children}
      {iconEnd && icon}
    </button>
  )
}
