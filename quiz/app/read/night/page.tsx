import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { NightReader } from "@/components/night-reader"

// Static: the player and the stored recording live on the device, so the page opens offline.
export default function NightPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 max-w-4xl mx-auto px-4 py-8 w-full">
        <h1 className="sr-only text-2xl font-bold mb-4">Night reading</h1>
        <NightReader />
      </main>
      <SiteFooter />
    </div>
  )
}
