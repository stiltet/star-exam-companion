import { existsSync, readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { activePack } from "@/lib/pack"
import { courseBundle } from "@/lib/course-text"
import { type PageSummary } from "@/lib/reading"
import { coursePages, pageList, readingPages, staticList, workerScript } from "@/lib/sw"

export const dynamic = "force-dynamic"

const BUNDLE_WAIT_MS = 3000

// Each course's readings as last sent to a worker, kept while the Mac runs.
const lastPages = new Map<string, PageSummary[]>()

// The service worker, with this build's id and file list built in. Only a production build has one.
export async function GET() {
  const dist = path.join(process.cwd(), process.env.QUIZ_DIST_DIR ?? ".next")
  const buildFile = path.join(dist, "BUILD_ID")
  if (!existsSync(buildFile)) return new Response("Not found", { status: 404 })
  const files = (dir: string) => (existsSync(dir) ? readdirSync(dir, { recursive: true, withFileTypes: true }).filter((entry) => entry.isFile()).map((entry) => path.relative(dir, path.join(entry.parentPath, entry.name))) : [])
  const publicDir = path.join(process.cwd(), "public")
  // Read Aloud's readings come from Google's bundles, which the Mac keeps for a day; a course
  // Google does not send in time stores its list only, and its readings at the next update.
  // The wait is capped, so a cold Mac never holds up the worker itself; a late course
  // reuses its last list (coursePages). Same build, same store name, so what the phone already
  // holds stays.
  let timer: ReturnType<typeof setTimeout> | undefined
  const late = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), BUNDLE_WAIT_MS)
  })
  const pack = activePack()
  const courses = await coursePages(pack.courses, courseBundle, late, lastPages)
  clearTimeout(timer)
  const sectionNumbers = [...new Set(Object.values(pack.meta.sectionOf))].sort()
  const config = {
    build: readFileSync(buildFile, "utf8").trim(),
    pages: [...pageList(pack.study.sections, sectionNumbers, pack.meta), ...readingPages([...courses, ...pack.noReading.map((course) => ({ id: course.id, pages: null }))])],
    statics: [...staticList(files(path.join(dist, "static")), "/_next/static"), ...staticList(files(publicDir), ""), "/manifest.webmanifest"],
  }
  const worker = readFileSync(path.join(process.cwd(), "lib/sw-worker.js"), "utf8")
  return new Response(workerScript(config, worker), {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Content-Security-Policy": "default-src 'self'; script-src 'self'",
    },
  })
}
