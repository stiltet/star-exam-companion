import type { ComponentProps } from "react"

// The quiz's select atom: a native dropdown, full width on a phone and as wide as its longest choice from sm
// up. Its look lives here; the parent places it.
export function Select({ placement, children, ...props }: Omit<ComponentProps<"select">, "className"> & { placement?: string }) {
  return (
    <select {...props} className={["w-full sm:w-auto border-2 border-foreground bg-background text-foreground px-3 py-2 disabled:opacity-50", placement].filter(Boolean).join(" ")}>
      {children}
    </select>
  )
}
