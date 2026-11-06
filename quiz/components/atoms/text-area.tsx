import type { ComponentProps } from "react"

export function TextArea({ placement, ...props }: Omit<ComponentProps<"textarea">, "className"> & { placement?: string }) {
  return (
    <textarea
      {...props}
      className={["w-full border-2 border-foreground bg-background text-foreground px-3 py-2 font-mono text-sm", placement].filter(Boolean).join(" ")}
    />
  )
}
