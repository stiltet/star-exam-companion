import type { ComponentProps } from "react"

// The quiz's icon button: a square the size of the header's menu button, with a picture in it. tone: good is green, bad is red, and
// neutral keeps the text colour, so a status picture can say fine, not fine or not applicable. Its look lives here; the parent places it.
export type IconTone = "good" | "bad" | "neutral"

const TONE: Record<IconTone, string> = {
  good: "text-green-700 dark:text-green-400",
  bad: "text-red-600 dark:text-red-400",
  neutral: "",
}

export function IconButton({ tone, children, ...props }: { tone: IconTone } & Omit<ComponentProps<"button">, "className" | "type">) {
  return (
    <button type="button" {...props} className={["flex size-11 shrink-0 items-center justify-center", TONE[tone]].filter(Boolean).join(" ")}>
      {children}
    </button>
  )
}
