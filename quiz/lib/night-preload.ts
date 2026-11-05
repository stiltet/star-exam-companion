import { beginNightBuild } from "./night-build.ts"
import { activePack } from "./pack.ts"

// Starts the Night reading recording of the exam this install serves, without waiting for anyone to open the page.
// Used when the server starts and after the exam is switched. A build already running or finished is left as it is.
// `begin` and `reads` are the build start and the exam's reading flag, so a test can watch them.
export function startNightPreload(
  begin: (retry: boolean, preload: boolean) => unknown = beginNightBuild,
  reads: () => boolean = () => activePack().meta.reading,
): void {
  if (process.env.QUIZ_NIGHT_PRELOAD === "0") return
  try {
    // An exam with no reading has nothing to build; its page says so when it is opened.
    if (!reads()) return
    begin(false, true)
  } catch {
    // The page's own status request starts the build too, so a start that throws here only means the later start.
  }
}
