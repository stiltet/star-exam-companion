// Runs once when the server starts. The Night reading recording is built on the Mac, which takes a while, so it
// starts now instead of when someone first opens the page: the page then finds it ready (or well on its way).
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.QUIZ_NIGHT_PRELOAD === "0") return
  try {
    const { startNightPreload } = await import("./lib/night-preload.ts")
    startNightPreload()
  } catch {
    // The recording is also started by the page's own status request, so a failed early start only means the old,
    // later start: nothing else depends on it.
  }
}
