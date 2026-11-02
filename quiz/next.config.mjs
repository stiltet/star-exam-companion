import { execSync } from "node:child_process"
import { readFileSync } from "node:fs"

// The exam pack this build serves (docs/exam-packs.md). Some pages are built ahead, so it is read at build time too.
const exam = process.env.QUIZ_EXAM || "generative-ai-leader"
function packReads() {
  try {
    return JSON.parse(readFileSync(new URL(`../exams/${exam}/pack.json`, import.meta.url), "utf8")).reading !== false
  } catch {
    return true
  }
}

/** @type {import('next').NextConfig} */
// quiz.sh builds the service into .next-service; the gate's build keeps .next.
const distDir = process.env.QUIZ_DIST_DIR || ".next"

// Shown in every footer, so the phone tells which build it runs. Stamped when the service starts.
function commit() {
  // A build outside the repository, such as the online demo's temporary copy, is told its commit.
  if (process.env.QUIZ_COMMIT) return process.env.QUIZ_COMMIT
  try {
    return execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim()
  } catch {
    return "unknown"
  }
}
const builtAt = new Date().toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })

// The online demo on GitHub Pages (scripts/build-pages.sh): plain exported files, served from a
// sub-path, with no server. The normal build never sets QUIZ_STATIC.
const staticDemo = process.env.QUIZ_STATIC === "1"

const nextConfig = {
  agentRules: false,
  distDir,
  ...(staticDemo ? { output: "export", basePath: process.env.QUIZ_BASE_PATH || "", trailingSlash: true } : {}),
  // Built in, so /sw.js finds this build's BUILD_ID.
  env: { QUIZ_DIST_DIR: distDir, NEXT_PUBLIC_QUIZ_EXAM: exam, NEXT_PUBLIC_QUIZ_READING: packReads() ? "1" : "0", NEXT_PUBLIC_QUIZ_COMMIT: commit(), NEXT_PUBLIC_QUIZ_BUILT_AT: builtAt },
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
