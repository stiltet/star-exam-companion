import { SiteHeaderView } from "@/components/site-header-view"
import { activePack } from "@/lib/pack"
import { sitePages } from "@/lib/pages"

// The menu of the exam this install serves, read for each request.
export function SiteHeader() {
  const links = sitePages(activePack().meta).map((page) => ({ href: page.href, label: page.menu }))
  return <SiteHeaderView links={links} />
}
