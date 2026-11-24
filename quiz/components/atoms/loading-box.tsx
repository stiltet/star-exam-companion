// The quiz's loading box atom: the app icon in a box that fills from left to right, centred over the page,
// which stays where it is behind. Used while a page is not ready and when the logo link is tapped (the
// header never changes itself). delayed: it appears only after 200 ms, by CSS alone, so it needs no script.
// Every box that shows over a visible page (neither delayed, which sits over a page the gate already hides, nor the
// launch cover, which has its own rule) also hides the page behind it (globals.css, loading-full), so the header
// and the bars can never be seen beside it, whatever the phone does with stacking.
export function LoadingBox({ delayed = false, cover = false }: { delayed?: boolean; cover?: boolean }) {
  const kind = delayed ? "page-loading " : cover ? "" : "loading-full "
  return (
    <div role="status" aria-label="Loading" className={`${kind}pointer-events-none fixed inset-0 z-[100] flex items-center justify-center bg-background`}>
      <div data-loading="true" className="loading-box relative h-12 w-56 overflow-hidden border-2 border-foreground text-foreground" />
    </div>
  )
}
