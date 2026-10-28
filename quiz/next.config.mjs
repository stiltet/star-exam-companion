import { execSync } from "node:child_process"

/** @type {import('next').NextConfig} */
// quiz.sh builds the service into .next-service; the gate's build keeps .next.
const distDir = process.env.QUIZ_DIST_DIR || ".next"

// Shown in every footer, so the phone tells which build it runs. Stamped when the service starts.
function commit() {
  try {
    return execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim()
  } catch {
    return "unknown"
  }
}
const builtAt = new Date().toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })

const nextConfig = {
  agentRules: false,
  distDir,
  // Built in, so /sw.js finds this build's BUILD_ID.
  env: { QUIZ_DIST_DIR: distDir, NEXT_PUBLIC_QUIZ_COMMIT: commit(), NEXT_PUBLIC_QUIZ_BUILT_AT: builtAt },
  // The development badge moves right: the Back button (components/back-button.tsx) sits bottom left.
  devIndicators: { position: "bottom-right" },
  // A phone on the home network may load the dev server only from QUIZ_LAN_HOST (docs/https.md).
  // Trimmed and lower-cased as lib/origin.ts does, so the two lists always agree.
  allowedDevOrigins: process.env.QUIZ_LAN_HOST?.trim() ? [process.env.QUIZ_LAN_HOST.trim().toLowerCase()] : [],
  images: {
    unoptimized: true,
  },
}

export default nextConfig
