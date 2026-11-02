import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import Link from "next/link"
import { ActionLink } from "@/components/atoms/button"
import { activePack } from "@/lib/pack"
import { sitePages } from "@/lib/pages"

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />

      <main className="flex-1 max-w-4xl mx-auto px-4 py-8 w-full flex flex-col items-center justify-center">
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
      </main>

      <SiteFooter />
    </div>
  )
}
