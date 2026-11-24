import type React from "react"
import { Suspense } from "react"
import type { Metadata, Viewport } from "next"
import { BackButton } from "@/components/back-button"
import { ResumeLastPage } from "@/components/resume-last-page"
import { LoadingBox } from "@/components/atoms/loading-box"
import { RESUME_SCRIPT } from "@/lib/last-page"
import { DevBadgeStyle } from "@/components/dev-badge-style"
import { PullToRefresh } from "@/components/pull-to-refresh"
import { NavProgress } from "@/components/nav-progress"
import { PageGate } from "@/components/page-gate"
import "./globals.css"
import { activePack } from "@/lib/pack"
import { OutboxSender } from "@/components/outbox"
import { OfflineShell } from "@/components/offline"
import { SnapshotPrefetch } from "@/components/snapshot"
import { AudioUnlock } from "@/components/audio"
import { ThemeProvider } from "@/components/theme-provider"
import { DemoBanner } from "@/components/demo-banner"
import { InstallHint } from "@/components/install-hint"
import { APP_NAME, APP_SHORT_NAME, BASE_PATH, STATIC_DEMO } from "@/lib/static-demo"
import { connection } from "next/server"

// Next does not add a sub-path to these links itself. Empty everywhere except the online demo,
// which is served from /star-exam-companion on GitHub Pages.
const base = BASE_PATH

// Read for each request: the exam can be switched while the quiz runs.
export async function generateMetadata(): Promise<Metadata> {
  if (!STATIC_DEMO) await connection()
  const pack = activePack().meta
  return {
    title: APP_NAME,
    description: `Open-source exam preparation for the ${pack.certification} certification. Brutalist. Minimal. Exam Focused.`,
    keywords: ["Google Cloud", ...(pack.keywords ?? []), "Certification", "Exam Prep", pack.title],
    icons: {
      icon: `${base}/favicon.png`,
      shortcut: `${base}/favicon.png`,
      apple: `${base}/apple-touch-icon.png`,
    },
    appleWebApp: {
      capable: true,
      title: APP_SHORT_NAME,
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
        <script dangerouslySetInnerHTML={{ __html: RESUME_SCRIPT }} />
        <div className="resume-cover"><LoadingBox cover /></div>
        <noscript><style>{".page-loading{display:none}[data-page-ready]{visibility:visible!important}"}</style></noscript>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange enableColorScheme={false} storageKey="quiz-theme">
          <DemoBanner />
          <PageGate>{children}</PageGate>
          <BackButton />
          <Suspense fallback={null}>
            <ResumeLastPage />
          </Suspense>
          <DevBadgeStyle />
          <OutboxSender />
          <OfflineShell />
          <SnapshotPrefetch />
          <AudioUnlock />
          <Suspense fallback={null}>
            <NavProgress />
          </Suspense>
          <PullToRefresh />
          <InstallHint />
        </ThemeProvider>
      </body>
    </html>
  )
}
