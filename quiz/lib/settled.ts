// Resolves when the page has finished settling after it became ready: its fonts are loaded and two frames have been drawn,
// so nothing shifts or restyles the moment the loading screen goes. Never waits longer than a second in all, because
// frames do not run in a hidden page and a font that never arrives must not hold the app.
export function settled(): Promise<void> {
  const frames = new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
  const fonts = document.fonts?.ready ?? Promise.resolve()
  const limit = new Promise<void>((resolve) => window.setTimeout(resolve, 1000))
  return Promise.race([Promise.all([fonts, frames]).then(() => undefined), limit])
}
