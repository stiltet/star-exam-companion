// pnpm --dir quiz reading:path <learning-path address or number> [--json]
//
// Reads a Google Skills learning path and lists its courses in Google's order, so an exam pack's courses.json is never typed by
// hand. With --json it prints the whole courses.json as JSON and nothing else. It uses the same separate Chrome for Testing as the
// crawl and never changes anything: it only reads the page.
import { coursesFile, pathAddress, pathCourses, type PathCard } from "../lib/reading-path.ts"
import { NO_BROWSER_MESSAGE, SITE, acceptOfferedSignIn, openBrowser, signedInAs } from "./reading-browser.mts"
import { log, logPath, startLog } from "./reading-log.mts"

const args = process.argv.slice(2)
const json = args.includes("--json")
const input = args.find((arg) => !arg.startsWith("--"))
const verbose = args.includes("--debug") || process.env.READING_DEBUG === "1"
startLog("reading-path", verbose)
log("run.start", { input: input ?? "", json, debug: verbose })
const address = input ? pathAddress(input, SITE) : null
if (!address) {
  console.error("Usage: pnpm --dir quiz reading:path <learning-path address or number> [--json]")
  console.error("  Example: pnpm --dir quiz reading:path https://www.skills.google/paths/4525")
  process.exit(2)
}

const opened = await openBrowser()
if (!opened) {
  console.error(NO_BROWSER_MESSAGE)
  log("run.end", { exit: 1, reason: "no browser" })
  if (logPath()) console.error(`Log: ${logPath()}`)
  process.exit(1)
}
try {
  await acceptOfferedSignIn(opened.page, opened.context)
  await signedInAs(opened.page)
  await opened.page.goto(address, { waitUntil: "domcontentloaded", timeout: 60_000 })
  // READING_PATH_WAIT_MS shortens the wait for the cards (tests); the real wait is 30 s.
  await opened.page.waitForSelector("ql-activity-card", { timeout: Number(process.env.READING_PATH_WAIT_MS ?? 30_000) }).catch(() => {})
  const found = await opened.page.evaluate(() => ({
    title: (document.querySelector("h1")?.textContent ?? "").trim(),
    cards: [...document.querySelectorAll("ql-activity-card")].map((card) => ({
      type: card.getAttribute("type") ?? "",
      title: card.getAttribute("name") ?? "",
      href: (card.shadowRoot?.querySelector("a[href]") ?? card.querySelector("a[href]"))?.getAttribute("href") ?? "",
    })),
  })) as { title: string; cards: PathCard[] }
  const courses = pathCourses(found.cards)
  log("path.read", { cards: found.cards.length, courses: courses.length, title: found.title })
  if (courses.length === 0) {
    console.error(`✖ No courses were found at ${address}.`)
    console.error("  Check the address, and that Chrome for Testing is signed in to Google Skills (skills/capture-reading/SKILL.md).")
    process.exitCode = 1
  } else if (json) {
    console.log(JSON.stringify({ title: found.title, ...coursesFile(address, courses) }, null, 2))
  } else {
    console.log("")
    console.log(`Learning path: ${found.title || "(no title)"}`)
    console.log(`  ${address}`)
    console.log("")
    for (const course of courses) console.log(`  ${course.id}. ${course.title}  (course ${course.template})`)
    console.log("")
    console.log(`  ${courses.length} ${courses.length === 1 ? "course" : "courses"}, in Google's order.`)
    console.log("")
  }
} finally {
  await opened.close()
  log("run.end", { exit: process.exitCode ?? 0 })
  // The log path goes to the error stream, so the JSON on the output stays the only thing there.
  if (logPath()) console.error(`Log: ${logPath()}`)
}
