import type React from "react"
import type { Metadata, Viewport } from "next"
import { BackButton } from "@/components/back-button"
import { DevBadgeStyle } from "@/components/dev-badge-style"
import { PullToRefresh } from "@/components/pull-to-refresh"
import "./globals.css"
import { OutboxSender } from "@/components/outbox"
import { OfflineShell } from "@/components/offline"
import { SnapshotPrefetch } from "@/components/snapshot"
import { AudioUnlock } from "@/components/audio"
import { ThemeProvider } from "@/components/theme-provider"

export const metadata: Metadata = {
  title: "Star Exam Companion",
  description:
    "Open-source exam preparation for Google Cloud Generative AI Leader certification. Brutalist. Minimal. Exam-focused.",
  keywords: ["Google Cloud", "Generative AI", "Certification", "Exam Prep", "GCGAI Leader"],
  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    title: "Star Exam Companion",
    statusBarStyle: "default",
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    // next-themes sets the theme class on <html> before React loads, so the server's copy differs.
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange enableColorScheme={false} storageKey="quiz-theme">
          {children}
          <BackButton />
          <DevBadgeStyle />
          <OutboxSender />
          <OfflineShell />
          <SnapshotPrefetch />
          <AudioUnlock />
          <PullToRefresh />
        </ThemeProvider>
      </body>
    </html>
  )
}
