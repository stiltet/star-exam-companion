import Link from "next/link"

export type Crumb = { label: string; href?: string }

// The quiz's breadcrumb atom: the way back through the list, then where the reader is, such as READ ALOUD / COURSE 3.
// Every crumb with a link is a link, the last is the page itself. Its look lives here; the page shell places it, fixed under the header.
export function Breadcrumb({ trail }: { trail: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
      {trail.map((crumb, index) => (
        <span key={`${index}-${crumb.label}`}>
          {index > 0 && <span className="mx-2">/</span>}
          {crumb.href ? <Link href={crumb.href}>{crumb.label}</Link> : <span className="text-foreground">{crumb.label}</span>}
        </span>
      ))}
    </nav>
  )
}
