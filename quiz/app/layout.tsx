import type React from "react"
import type { Metadata, Viewport } from "next"
import { BackButton } from "@/components/back-button"
import { DevBadgeStyle } from "@/components/dev-badge-style"
import { PullToRefresh } from "@/components/pull-to-refresh"
import "./globals.css"
import { activePack } from "@/lib/pack"
import { OutboxSender } from "@/components/outbox"
import { OfflineShell } from "@/components/offline"
import { SnapshotPrefetch } from "@/components/snapshot"
import { AudioUnlock } from "@/components/audio"
import { ThemeProvider } from "@/components/theme-provider"
import { DemoBanner } from "@/components/demo-banner"
import { InstallHint } from "@/components/install-hint"
import { BASE_PATH, STATIC_DEMO } from "@/lib/static-demo"
import { connection } from "next/server"

// Next does not add a sub-path to these links itself. Empty everywhere except the online demo,
// which is served from /star-exam-companion on GitHub Pages.
const base = BASE_PATH

// Read for each request: the exam can be switched while the quiz runs.
export async function generateMetadata(): Promise<Metadata> {
  if (!STATIC_DEMO) await connection()
  const pack = activePack().meta
  return {
    title: "Star Exam Companion",
    description: `Open-source exam preparation for the ${pack.certification} certification. Brutalist. Minimal. Exam Focused.`,
    keywords: ["Google Cloud", ...(pack.keywords ?? []), "Certification", "Exam Prep", pack.title],
    icons: {
      icon: `${base}/favicon.png`,
      shortcut: `${base}/favicon.png`,
      apple: `${base}/apple-touch-icon.png`,
    },
    appleWebApp: {
      capable: true,
      title: "Star Exam Companion",
      statusBarStyle: "default",
    },
  }
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Per request, so a switch of exam shows at once; the online demo is built once and has one exam.
  if (!STATIC_DEMO) await connection()
  const pack = activePack().meta
  return (
    // next-themes sets the theme class on <html> before React loads, so the server's copy differs.
    <html lang="en" suppressHydrationWarning data-exam={pack.id}>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange enableColorScheme={false} storageKey="quiz-theme">
          <DemoBanner />
          {children}
          <BackButton />
          <DevBadgeStyle />
          <OutboxSender />
          <OfflineShell />
          <SnapshotPrefetch />
          <AudioUnlock />
          <PullToRefresh />
          <InstallHint />
        </ThemeProvider>
      </body>
    </html>
  )
}
