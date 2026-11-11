"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { Menu, X } from "lucide-react"
import { phoneTitle } from "@/lib/pages"
import { ConnectionIcon, useConnection } from "@/components/connection-status"
import { SavingPanel } from "@/components/saving-panel"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
// Imported, not "/logo.png": the URL then carries the file's hash, so the phone's worker, which
// keeps statics until asked for a new URL, shows a new logo as soon as it changes.
import logo from "@/public/logo.png"
import { DemoExams } from "@/components/demo-exams"
import { STATIC_DEMO } from "@/lib/static-demo"

// The header carries the page title at every width, and the page's own h1 is visually hidden (sr-only).

export function SiteHeaderView({ links: LINKS }: { links: { href: string; label: string }[] }) {
  const pathname = usePathname()
  // One dropdown at a time under the header: the menu or the Saving panel. Opening one shuts the other.
  const [panel, setPanel] = useState<"menu" | "saving" | null>(null)
  const open = panel === "menu"
  const saving = panel === "saving"
  const setOpen = (next: boolean | ((was: boolean) => boolean)) => setPanel((was) => ((typeof next === "function" ? next(was === "menu") : next) ? "menu" : was === "menu" ? null : was))
  const connection = useConnection()
  const headerRef = useRef<HTMLElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const savingButtonRef = useRef<HTMLButtonElement>(null)
  // From sm up the Saving panel is a dialog, which handles its own outside tap and Escape.
  const [wide, setWide] = useState(false)
  useEffect(() => {
    const query = window.matchMedia("(min-width: 640px)")
    const read = () => setWide(query.matches)
    read()
    query.addEventListener("change", read)
    return () => query.removeEventListener("change", read)
  }, [])

  // A link was followed: the new page starts with both shut.
  useEffect(() => setPanel(null), [pathname])

  // While a dropdown is open, a tap outside the header or Escape shuts it; so does a scroll, except for
  // the Saving panel, which scrolls inside itself and stays readable.
  useEffect(() => {
    if (!panel || (panel === "saving" && wide)) return
    const outside = (event: PointerEvent) => {
      if (!headerRef.current?.contains(event.target as Node)) setPanel(null)
    }
    // A few pixels of drift (iOS resizing its address bar after the tap) is not a scroll.
    const openedAt = window.scrollY
    const scrolled = () => {
      if (panel === "menu" && Math.abs(window.scrollY - openedAt) > 12) setPanel(null)
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      setPanel(null)
      ;(panel === "saving" ? savingButtonRef : buttonRef).current?.focus()
    }
    document.addEventListener("pointerdown", outside)
    window.addEventListener("scroll", scrolled, { passive: true })
    document.addEventListener("keydown", escape)
    return () => {
      document.removeEventListener("pointerdown", outside)
      window.removeEventListener("scroll", scrolled)
      document.removeEventListener("keydown", escape)
    }
  }, [panel, wide])

  const current = (href: string) => pathname === href || pathname.startsWith(`${href}/`)

  return (
    <header ref={headerRef} className="relative z-40 border-b-2 border-foreground bg-background">
      <div className="max-w-4xl mx-auto px-4 py-2 sm:py-4">
        <nav className="flex items-center justify-between gap-2 sm:gap-4 sm:min-h-14">
          <Link href="/" className="flex items-center gap-2 no-underline hover:opacity-80 min-w-0 sm:flex-1">
            <Image src={logo} alt="" width={50} height={50} className="size-8 sm:size-[50px] shrink-0" />
            <span className="font-bold text-lg truncate sm:text-xl sm:ml-3 sm:whitespace-normal sm:overflow-visible sm:text-clip">{phoneTitle(pathname)}</span>
          </Link>
          {/* Two fixed rows of four on desktop: the title takes what is left, so the links stay put on every page. */}
          <div className="hidden sm:grid grid-cols-[repeat(4,auto)] shrink-0 gap-x-4 gap-y-2 text-sm">
            {LINKS.map((link) => (
              <Link key={link.href} href={link.href} aria-current={current(link.href) ? "page" : undefined}>
                {link.label}
              </Link>
            ))}
          </div>
          <div className="flex shrink-0 items-center">
            <ConnectionIcon state={connection} open={saving} onToggle={() => setPanel((was) => (was === "saving" ? null : "saving"))} buttonRef={savingButtonRef} />
            <button
              ref={buttonRef}
              type="button"
              className="sm:hidden -mr-2 flex size-11 shrink-0 items-center justify-center"
              aria-label={open ? "Close menu" : "Open menu"}
              aria-expanded={open}
              aria-controls="site-menu"
              onClick={() => setOpen((was) => !was)}
            >
              {open ? <X className="size-6" aria-hidden /> : <Menu className="size-6" aria-hidden />}
            </button>
          </div>
        </nav>
      </div>
      {STATIC_DEMO && <DemoExams />}
      {/* Positioned from the header's padding edge, so it draws its own top line over the header's. */}
      {open && (
        <div id="site-menu" className="sm:hidden absolute inset-x-0 top-full border-y-2 border-foreground bg-background shadow-lg">
          <ul className="max-w-4xl mx-auto py-2">
            {LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={current(link.href) ? "page" : undefined}
                  className={`block px-4 py-3 no-underline ${current(link.href) ? "font-bold bg-foreground text-background" : "active:bg-muted"}`}
                  onClick={() => setOpen(false)}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      {saving && !wide && (
        <div id="saving-panel" className="sm:hidden absolute inset-x-0 top-full max-h-[calc(100dvh-4.5rem)] overflow-y-auto border-y-2 border-foreground bg-background shadow-lg">
          <SavingPanel connection={connection} />
        </div>
      )}
      <Dialog open={saving && wide} onOpenChange={(next) => { if (!next) { setPanel(null); savingButtonRef.current?.focus() } }}>
        <DialogContent id="saving-panel" aria-describedby={undefined} showCloseButton={false} className="gap-0 rounded-none border-2 border-foreground p-0 sm:max-w-2xl">
          <DialogTitle className="sr-only">Status</DialogTitle>
          <SavingPanel connection={connection} />
        </DialogContent>
      </Dialog>
    </header>
  )
}
