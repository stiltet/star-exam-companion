import Link from "next/link"

// The quiz's breadcrumb atom: the way back to the list, then where the reader is, such as READ ALOUD / COURSE 3.
// Its look lives here; the parent places it.
export function Breadcrumb({ back, current, placement }: { back: { href: string; label: string }; current: string; placement?: string }) {
  return (
    <nav aria-label="Breadcrumb" className={["text-sm text-muted-foreground", placement].filter(Boolean).join(" ")}>
      <Link href={back.href}>{back.label}</Link>
      <span className="mx-2">/</span>
      <span className="text-foreground">{current}</span>
    </nav>
  )
}
