import { PageShell } from "@/components/organisms/page-shell"
import Link from "next/link"
import { ActionLink } from "@/components/atoms/button"
import { activePack } from "@/lib/pack"
import { sitePages } from "@/lib/pages"

export default function NotFound() {
  return (
    <PageShell variant="centered">
      <div className="text-center">
        <h1 className="text-6xl font-bold mb-4">404</h1>
        <h2 className="text-2xl font-bold mb-2">PAGE NOT FOUND</h2>
        <p className="text-muted-foreground mb-8">
          This page is not on the quiz, or it has moved.
        </p>

        <div className="border-2 border-foreground p-6 mb-6 text-left">
          <h3 className="font-bold mb-4">Available pages</h3>
          <ul className="space-y-2 text-sm">
            {sitePages(activePack().meta).map((page) => (
              <li key={page.href}>→ <Link href={page.href} className="underline">{page.menu}</Link> — {page.blurb}</li>
            ))}
          </ul>
        </div>

        <div className="flex flex-wrap gap-4 justify-center">
          <ActionLink variant="outlined" href="/">Back home</ActionLink>
          <ActionLink variant="filled" href="/study" arrow>Go to study</ActionLink>
        </div>
      </div>
    </PageShell>
  )
}
