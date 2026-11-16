// The quiz's loading box atom: the app icon in a box that fills from left to right, centred over the page,
// which stays where it is behind. Used while a page is not ready and when the logo link is tapped (the
// header never changes itself). delayed: it appears only after 200 ms, by CSS alone, so it needs no script.
export function LoadingBox({ delayed = false }: { delayed?: boolean }) {
  return (
    <div role="status" aria-label="Loading" className={`${delayed ? "page-loading " : ""}pointer-events-none fixed inset-0 z-40 flex items-center justify-center bg-background`}>
      <div data-loading="true" className="loading-box relative h-12 w-56 overflow-hidden border-2 border-foreground text-foreground" />
    </div>
  )
}
