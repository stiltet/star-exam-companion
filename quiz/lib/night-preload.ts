import { beginNightBuild } from "./night-build.ts"

// Starts the Night reading recording of the exam this install serves, without waiting for anyone to open the page.
// Used when the server starts and after the exam is switched. A build already running or finished is left as it is.
export function startNightPreload(): void {
  if (process.env.QUIZ_NIGHT_PRELOAD === "0") return
  try {
    beginNightBuild(false)
  } catch {
    // An exam with no reading, or no courses, has nothing to build. The page says so when it is opened.
  }
}
