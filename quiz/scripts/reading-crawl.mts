// pnpm --dir quiz reading:crawl [<exam>|all]
//
// Saves the lessons of every private course of every exam (or of one named exam) as private readings. No AI, no tokens:
// it uses a separate Chrome for Testing on its own profile folder (never the user's everyday Chrome), started headless by
// this command or already running on the port, signs in with the saved Google account, and reads each lesson in turn. Lesson text goes only to the private store
// (outside the repository). The manifest it keeps per course holds titles, addresses and hashes, never text.
// Every run reads every lesson and saves the missing ones and any whose text changed.
import { type Frame, type Page } from "@playwright/test"
import { listPacks, loadPack, repoRoot, type Pack } from "../lib/pack.ts"
import { describeError, maskAddress } from "../lib/debug-log.ts"
import { cleanLessonText } from "../lib/lesson-text.ts"
import { looksLikePdf, pdfText } from "../lib/pdf-text.ts"
import { privateReadingRoot, readPrivateReadings, savePrivateReading } from "../lib/private-reading.ts"
import {
  compareLessons,
  finalReport,
  lessonPageId,
  manifestFile,
  paint,
  progressLine,
  randomPauseMs,
  readManifest,
  textHash,
  writeManifest,
  type Colour,
  type CourseResult,
  type CourseSummary,
  type Lesson,
  type Manifest,
  type ManifestLesson,
  type ProgressState,
} from "../lib/reading-crawl.ts"
import { debug, log, logPath, startLog } from "./reading-log.mts"
import { NO_BROWSER_MESSAGE, SITE, acceptOfferedSignIn, isLessonHost, openBrowser, signedInAs, sleep } from "./reading-browser.mts"

const MIN_TEXT_CHARS = 40
const MAX_ATTEMPTS = 5
// A lesson's text is read only once it has stopped changing: the page rewrites it for a few seconds after it loads.
// The three waits can be shortened by environment variables so a test runs in seconds; the defaults are the real behaviour.
const SETTLE_MS = Number(process.env.READING_SETTLE_MS ?? 2_000)
const MIN_WATCH_MS = Number(process.env.READING_MIN_WATCH_MS ?? 3_500)
const EMPTY_AFTER_MS = Number(process.env.READING_EMPTY_AFTER_MS ?? 6_000)
const MAX_WATCH_MS = 25_000

const args = process.argv.slice(2)
const target = args.find((arg) => !arg.startsWith("--")) ?? "all"
// --debug (or READING_DEBUG=1) adds the detail to the log file; the log itself is written on every run.
const verbose = args.includes("--debug") || process.env.READING_DEBUG === "1"

const tty = Boolean(process.stdout.isTTY)
const colour = tty && !process.env.NO_COLOR
const say = (name: Colour, text: string): string => paint(name, text, colour)
let stopping = false
let stoppedBecause: string | null = null
// Before the lessons start (signing in, listing the courses) a stop closes the browser and ends at once; once they have started it
// finishes the lesson it is on and prints the report. SIGTERM, which a package manager sends after a second Ctrl-C, counts the same.
let lessonsStarted = false
let closeBrowser: (() => Promise<void>) | undefined
function stopRequested(signal: string): void {
  stopping = true
  log("signal", { signal, lessonsStarted })
  stoppedBecause ??= signal === "SIGTERM" ? "stopped" : "stopped with Ctrl-C"
  if (!lessonsStarted) void (closeBrowser ? closeBrowser() : Promise.resolve()).finally(() => process.exit(130))
}
process.on("SIGINT", () => stopRequested("SIGINT"))
process.on("SIGTERM", () => stopRequested("SIGTERM"))

type PrivateCourse = { pack: Pack; id: string; template: string; title: string }

function privateCourses(): { examId: string; title: string; selected: boolean; courses: PrivateCourse[] }[] {
  const root = repoRoot()
  const known = listPacks(root).map((entry) => entry.id)
  if (target !== "all" && !known.includes(target)) {
    console.error(`Unknown exam "${target}". Known exams: ${known.join(", ")}.`)
    process.exit(2)
  }
  return known
    .map((id) => {
      const pack = loadPack(root, id)
      return {
        examId: id,
        title: pack.meta.title,
        selected: target === "all" || id === target,
        courses: pack.courses
          .filter((course) => course.provider === "private")
          .map((course) => ({ pack, id: course.id, template: course.template, title: course.title })),
      }
    })
}

// The lessons the course page lists, in order: its html_bundle, link and document cards. An address is made stable by dropping the
// per-person session number, so a manifest from one run compares with the next. The other cards (labs, videos, quizzes) hold no
// reading; they are counted by kind so a course with nothing to read can say what it holds instead.
async function listLessons(page: Page, template: string): Promise<{ lessons: Lesson[]; other: string }> {
  await page.goto(`${SITE}/course_templates/${template}`, { waitUntil: "domcontentloaded", timeout: 60_000 })
  await page.waitForSelector("ql-activity-card", { timeout: 30_000 }).catch(() => {})
  const cards = await page.evaluate(() =>
    [...document.querySelectorAll("ql-activity-card")].map((card) => ({
      type: card.getAttribute("type") ?? "",
      title: card.getAttribute("name") ?? "",
      href: (card.shadowRoot?.querySelector("a[href]") ?? card.querySelector("a[href]"))?.getAttribute("href") ?? "",
    })),
  )
  const reading = new Set(["html_bundle", "link", "document"])
  // A video card is listed in its place among the readings. Its page is never opened (that would play it and mark it watched):
  // it is saved by its title, and Read Aloud gives it a button that opens it on Google Skills.
  const videoOf = (href: string): string | null => /\/video\/(\d+)/.exec(href)?.[1] ?? null
  const lessons: Lesson[] = cards
    .filter((card) => reading.has(card.type) || videoOf(card.href) !== null)
    .map((entry): Lesson => {
      const video = videoOf(entry.href)
      if (video !== null) return { title: entry.title.trim(), href: `/course_templates/${template}/video/${video}`, kind: "video" }
      // Some courses list their lessons as html bundles, others as documents; both open a page that embeds the reading.
      const found = /\/(html_bundles|documents)\/(\d+)/.exec(entry.href)
      return { title: entry.title.trim(), href: found ? `/course_templates/${template}/${found[1]}/${found[2]}` : "" }
    })
    .filter((lesson) => lesson.title !== "" && lesson.href !== "")
  const kinds = new Map<string, number>()
  for (const card of cards) {
    if (reading.has(card.type) || videoOf(card.href) !== null || card.type === "" || card.type === "credential" || card.type === "survey") continue
    kinds.set(card.type, (kinds.get(card.type) ?? 0) + 1)
  }
  const other = [...kinds].map(([type, count]) => `${count} ${type}${count === 1 ? "" : "s"}`).join(", ")
  return { lessons, other }
}

// A lesson's reading is the page of the frame the lesson embeds, from the site's public lesson storage.
function lessonFrame(page: Page): Frame | undefined {
  return page.frames().find((frame) => frame !== page.mainFrame() && isLessonHost(new URL(frame.url() || "about:blank").hostname))
}

// Some readings are delivered as a PDF, so the page has no text of its own. Fetch each frame of the lesson from the public
// lesson storage, and when one is a PDF read its text. The PDF stays in memory; nothing is written to disk.
async function readPdf(page: Page): Promise<string | null> {
  for (const frame of page.frames()) {
    if (frame === page.mainFrame()) continue
    let url: URL
    try {
      url = new URL(frame.url())
    } catch {
      continue
    }
    if (!/^https?:$/.test(url.protocol) || !isLessonHost(url.hostname)) continue
    const response = await page.context().request.get(url.href, { timeout: 60_000 }).catch(() => null)
    if (!response?.ok()) continue
    const bytes = new Uint8Array(await response.body())
    if (!looksLikePdf(bytes)) continue
    const text = (await pdfText(bytes).catch(() => "")).trim()
    if (text.length >= MIN_TEXT_CHARS) return text
  }
  return null
}

async function noPageText(page: Page): Promise<{ status: "ok"; text: string } | { status: "empty" }> {
  const text = await readPdf(page)
  debug("lesson.pdf", { found: Boolean(text), chars: text ? text.length : 0 })
  return text ? { status: "ok", text } : { status: "empty" }
}

async function readLesson(page: Page, href: string): Promise<{ status: "ok"; text: string } | { status: "signin" } | { status: "empty" }> {
  const began = Date.now()
  // Not "networkidle": the site keeps loading trackers, so that wait can run out on a page that is already readable.
  await page.goto(`${SITE}${href}`, { waitUntil: "domcontentloaded", timeout: 60_000 })
  debug("lesson.goto", { address: maskAddress(`${SITE}${href}`), landed: maskAddress(page.url()), ms: Date.now() - began })
  if (page.url().includes("/users/sign_in")) return { status: "signin" }
  const deadline = Date.now() + 30_000
  let frame = lessonFrame(page)
  while (!frame && Date.now() < deadline) {
    await sleep(500)
    frame = lessonFrame(page)
  }
  debug("lesson.frame", { found: Boolean(frame), host: frame ? new URL(frame.url() || "about:blank").hostname : "", waitedMs: Date.now() - began })
  if (!frame) return noPageText(page)
  // Read the text again and again until two reads in a row, at least SETTLE_MS apart, are the same. A page with almost no text
  // (a quiz) has none to wait for, so it is called empty after a few seconds.
  const started = Date.now()
  let last = ""
  let sameSince = Date.now()
  while (Date.now() - started < MAX_WATCH_MS) {
    const text = cleanLessonText((await frame.evaluate(() => (document.body ? document.body.innerText : "")).catch(() => "")).trim())
    if (text !== last) {
      debug("lesson.read", { chars: text.length, sinceStartMs: Date.now() - started })
      last = text
      sameSince = Date.now()
    } else if (text.length >= MIN_TEXT_CHARS && Date.now() - sameSince >= SETTLE_MS && Date.now() - started >= MIN_WATCH_MS) {
      debug("lesson.settled", { chars: text.length, watchedMs: Date.now() - started })
      return { status: "ok", text }
    }
    if (text.length < MIN_TEXT_CHARS && Date.now() - started >= EMPTY_AFTER_MS) return noPageText(page)
    await sleep(600)
  }
  return last.length >= MIN_TEXT_CHARS ? { status: "ok", text: last } : noPageText(page)
}

const startedAt = Date.now()
const state: ProgressState = { page: 0, total: 0, course: "", title: "", saved: 0, updated: 0, same: 0, empty: 0, failed: 0, elapsedMs: 0, pauseLeft: null }

function show(final = false): void {
  state.elapsedMs = Date.now() - startedAt
  // One column less than the terminal is wide: a line that fills the last column wraps in some terminals.
  const line = progressLine(state, tty, (process.stdout.columns || 80) - 1, colour)
  if (!tty) {
    if (final) console.log(line)
    return
  }
  process.stdout.write(`\r\x1b[2K${line}`)
}

function logLine(text: string): void {
  if (tty) process.stdout.write("\r\x1b[2K")
  console.log(text)
}

async function pause(): Promise<void> {
  // READING_PAUSE_MS fixes the pause (tests); otherwise it is random, 2 to 15 s, drawn fresh for each page.
  const total = process.env.READING_PAUSE_MS !== undefined ? Number(process.env.READING_PAUSE_MS) : randomPauseMs()
  const end = Date.now() + total
  while (!stopping && Date.now() < end) {
    state.pauseLeft = Math.ceil((end - Date.now()) / 1000)
    if (tty) show()
    await sleep(Math.min(1000, end - Date.now()))
  }
  state.pauseLeft = null
}

async function main(): Promise<void> {
  // A blank line first, so the output stands apart from the package manager's own lines above it.
  console.log("")
  startLog("reading-crawl", verbose)
  log("run.start", { target, debug: verbose, node: process.version, platform: process.platform })
  const exams = privateCourses()
  const work = exams.filter((exam) => exam.selected).flatMap((exam) => exam.courses.map((course) => ({ examId: exam.examId, course })))
  // Every exam on the server is listed first, so it is plain what is captured and what is not.
  console.log(say("bold", "Exams on this server"))
  for (const exam of exams) {
    const what = !exam.selected
      ? "skipped (another exam was named)"
      : exam.courses.length === 0
        ? "nothing to capture (no private courses)"
        : `${exam.courses.length} courses to capture from Google Skills`
    console.log(`  ${exam.title}: ${what}`)
  }
  console.log("")
  if (work.length === 0) return
  const capturing = exams.filter((exam) => exam.selected && exam.courses.length > 0)
  console.log(`${say("bold", "Crawling")} ${capturing.map((exam) => say("bold", exam.title)).join(", ")}`)
  console.log("")

  const opened = await openBrowser()
  if (!opened) {
    const [first, ...rest] = NO_BROWSER_MESSAGE.split("\n")
    console.error([say("red", `✖ ${first}`), ...rest].join("\n"))
    log("run.end", { exit: 1, reason: "no browser" })
    if (logPath()) console.error(`Log: ${logPath()}`)
    process.exit(1)
  }
  const { page, context } = opened
  closeBrowser = opened.close
  const summaries: CourseSummary[] = []
  try {
    process.stdout.write(say("dim", "Signing in to Google Skills (this can take up to half a minute)...") + "\n")
    await acceptOfferedSignIn(page, context)
    const who = await signedInAs(page)
    logLine(who ? `Signed in as ${say("bold", who)}` : say("yellow", "Could not tell who is signed in to Google Skills."))
    logLine(say("yellow", "Reading a lesson marks it as completed on this Google account. Use a secondary account, not the one you study with."))
    logLine("")
    // List every course first, so the total is known before anything is saved.
    const listed: { examId: string; course: PrivateCourse; lessons: Lesson[]; other: string }[] = []
    for (const entry of work) listed.push({ ...entry, ...(await listLessons(page, entry.course.template)) })
    state.total = listed.reduce((sum, entry) => sum + entry.lessons.length, 0)
    for (const entry of listed) log("list.course", { course: entry.course.id, title: entry.course.title, lessons: entry.lessons.length, other: entry.other })
    log("run.listed", { courses: listed.length, lessons: state.total })
    if (state.total === 0) {
      // No course lists a lesson: most likely the browser is not signed in, so each course is named as an error.
      for (const entry of listed) logLine(say("red", `✖ ${entry.course.id}. ${entry.course.title}: the site lists no lessons for it.`))
      stoppedBecause = "the site lists no lessons"
      stopping = true
    } else {
      logLine(`Checking ${say("bold", String(state.total))} lessons in ${listed.length} course(s), pausing 2 to 15 s between pages. Ctrl-C stops it safely.`)
      logLine("")
    }

    lessonsStarted = true
    for (const { examId, course, lessons, other } of listed) {
      if (stopping) break
      const file = manifestFile(privateReadingRoot(), examId, course.id)
      const previous = await readManifest(file)
      const comparison = compareLessons(previous, lessons)
      const saved = await readPrivateReadings(examId, course.id)
      const savedById = new Map(saved.map((record) => [record.pageId, record]))
      // Pages saved earlier, by another tool, have other ids. They count as saved when their title matches, each used once,
      // so a lesson is never saved twice.
      const savedByTitle = new Map<string, (typeof saved)[number][]>()
      for (const record of saved) savedByTitle.set(record.title, [...(savedByTitle.get(record.title) ?? []), record])
      const claimed = new Set<string>()
      const outcome: CourseResult = { listed: lessons.length, saved: 0, already: 0, empty: [], failed: [], textChanged: [], unaccounted: [], comparison }
      const entries: ManifestLesson[] = []
      state.course = `${course.id}. ${course.title}`

      for (const lesson of lessons) {
        if (stopping) break
        state.page += 1
        state.title = lesson.title
        const ownId = lessonPageId(lesson.href)
        const byId = savedById.get(ownId)
        const existing = byId && !claimed.has(byId.pageId) ? byId : savedByTitle.get(lesson.title)?.find((record) => !claimed.has(record.pageId))
        if (existing) claimed.add(existing.pageId)
        const pageId = existing?.pageId ?? ownId
        show()
        let hash: string | null = existing ? textHash(existing.text) : null
        const lessonStarted = Date.now()
        let outcomeName = "failed"
        let chars = 0
        try {
          // A slow or failing page is tried up to five times, waiting 5, 10, 20 and 40 s between tries, before the lesson counts
          // as failed; a closed Chrome is never retried.
          let read: Awaited<ReturnType<typeof readLesson>> | undefined
          for (let attempt = 1; !read; attempt += 1) {
            try {
              read = lesson.kind === "video" ? { status: "ok", text: lesson.title } : await readLesson(page, lesson.href)
            } catch (error) {
              if (attempt >= MAX_ATTEMPTS || !opened.isConnected()) throw error
              logLine(say("yellow", `  retry ${attempt + 1} of ${MAX_ATTEMPTS}: ${lesson.title}`))
              log("lesson.retry", { n: state.page, title: lesson.title, attempt: attempt + 1, error: describeError(error) })
              await sleep(Number(process.env.READING_RETRY_BASE_MS ?? 5_000) * 2 ** (attempt - 1))
            }
          }
          if (read.status === "signin") {
            stoppedBecause = "Chrome for Testing is not signed in to Google Skills (see skills/capture-reading/SKILL.md, one-time sign-in)"
            stopping = true
            state.page -= 1
            break
          }
          if (read.status === "empty") {
            if (existing) {
              // No reading text on the page now (a quiz, say): the saved copy stays.
              outcome.already += 1
              state.same += 1
              outcomeName = "kept"
            } else {
              outcome.empty.push(lesson.title)
              state.empty += 1
              outcomeName = "empty"
            }
          } else {
            const newHash = textHash(read.text)
            chars = read.text.length
            if (existing && newHash === textHash(existing.text)) {
              outcome.already += 1
              state.same += 1
              outcomeName = "same"
            } else {
              await savePrivateReading(examId, course.id, { pageId, title: lesson.title, text: read.text })
              outcome.saved += 1
              if (existing) {
                outcome.textChanged.push(lesson.title)
                state.updated += 1
                outcomeName = "updated"
              } else {
                state.saved += 1
                outcomeName = "saved"
              }
              hash = newHash
            }
          }
        } catch (error) {
          // A Chrome that was closed is not a failed lesson: stop here and say so; the next run starts again from the first lesson.
          if (!opened.isConnected() || /has been closed|Target closed|Browser closed/.test(error instanceof Error ? error.message : "")) {
            stoppedBecause = "Chrome was closed"
            stopping = true
            state.page -= 1
            break
          }
          outcome.failed.push(lesson.title)
          state.failed += 1
          log("lesson.fail", { n: state.page, title: lesson.title, error: describeError(error) })
          // The message never carries lesson text; it is only the reason the step failed.
          logLine(say("red", `  ✖ ${lesson.title}: ${error instanceof Error ? error.message.split("\n")[0].slice(0, 120) : "unknown error"}`))
        }
        log("lesson.done", { course: course.id, n: state.page, of: state.total, title: lesson.title, outcome: outcomeName, chars, ms: Date.now() - lessonStarted })
        entries.push({ ...lesson, pageId, hash })
        const manifest: Manifest = { checkedAt: new Date().toISOString(), lessons: entries.concat(lessons.slice(entries.length).map((rest) => ({ ...rest, pageId: lessonPageId(rest.href), hash: null }))) }
        await writeManifest(file, manifest)
        show(true)
        if (!stopping && state.page < state.total && lesson.kind !== "video") await pause()
      }

      if (stopping) break
      await writeManifest(file, { checkedAt: new Date().toISOString(), lessons: entries })
      summaries.push({ id: course.id, title: course.title, result: outcome, noLessons: lessons.length === 0 ? other || "nothing to read" : undefined })
    }
  } finally {
    await opened.close()
  }

  if (tty) process.stdout.write("\r\x1b[2K")
  const report = finalReport({ courses: summaries, stopped: stoppedBecause, page: state.page, total: state.total, elapsedMs: Date.now() - startedAt }, colour, (process.stdout.columns || 80) - 1)
  console.log("")
  console.log(report)
  if (tty) process.stdout.write("\x07")
  if (stoppedBecause || summaries.some((entry) => entry.result.failed.length + entry.result.empty.length > 0 || entry.result.unaccounted.length > 0)) process.exitCode = 1
  if (stoppedBecause) log("stop", { reason: stoppedBecause, page: state.page, of: state.total })
  log("run.end", { exit: process.exitCode ?? 0, elapsedMs: Date.now() - startedAt, saved: state.saved, updated: state.updated, same: state.same, empty: state.empty, failed: state.failed })
  if (logPath()) console.log(`\n${say("dim", "Log:")} ${logPath()}`)
}

try {
  await main()
} catch (error) {
  log("run.error", { error: describeError(error), where: (error instanceof Error ? (error.stack ?? "").split("\n").slice(1, 4).map((line) => line.trim()).join(" | ") : "") })
  console.error(say("red", `✖ The command stopped with an error: ${describeError(error)}`))
  if (logPath()) console.error(`Log: ${logPath()}`)
  process.exitCode = 1
}
