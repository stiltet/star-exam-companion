"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { Menu, X } from "lucide-react"
import { phoneTitle } from "@/lib/pages"
import { ConnectionIcon, useConnection } from "@/components/connection-status"
// Imported, not "/logo.png": the URL then carries the file's hash, so the phone's worker, which
// keeps statics until asked for a new URL, shows a new logo as soon as it changes.
import logo from "@/public/logo.png"
import { DemoExams } from "@/components/demo-exams"
import { STATIC_DEMO } from "@/lib/static-demo"

// The header carries the page title at every width, and the page's own h1 is visually hidden (sr-only).

export function SiteHeaderView({ links: LINKS }: { links: { href: string; label: string }[] }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const connection = useConnection()
  const headerRef = useRef<HTMLElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  // A link was followed: the new page starts with the menu shut.
  useEffect(() => setOpen(false), [pathname])

  // While open, a tap outside the header, a scroll or Escape shuts it.
  useEffect(() => {
    if (!open) return
    const outside = (event: PointerEvent) => {
      if (!headerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    // A few pixels of drift (iOS resizing its address bar after the tap) is not a scroll.
    const openedAt = window.scrollY
    const scrolled = () => {
      if (Math.abs(window.scrollY - openedAt) > 12) setOpen(false)
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      setOpen(false)
      buttonRef.current?.focus()
    }
    document.addEventListener("pointerdown", outside)
    window.addEventListener("scroll", scrolled, { passive: true })
    document.addEventListener("keydown", escape)
    return () => {
      document.removeEventListener("pointerdown", outside)
      window.removeEventListener("scroll", scrolled)
      document.removeEventListener("keydown", escape)
    }
  }, [open])

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
          <ConnectionIcon state={connection} />
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
    </header>
  )
}
