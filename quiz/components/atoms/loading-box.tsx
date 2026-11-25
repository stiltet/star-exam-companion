// The quiz's loading box atom: the app icon in a box that fills from left to right, centred over the page,
// which stays where it is behind. Used while a page is not ready and when the logo link is tapped (the
// header never changes itself). delayed: it appears only after 200 ms, by CSS alone, so it needs no script.
// Every box that shows over a visible page (neither delayed, which sits over a page the gate already hides, nor the
// launch cover, which has its own rule) also hides the page behind it (globals.css, loading-full), so the header
// and the bars can never be seen beside it, whatever the phone does with stacking.
// route: the fallback of a route that can take many seconds (a course fetched from Google): it shows after 200 ms,
// hides the page behind it from then on, and stays until the page is there, with no 5 s hide.
// It cannot time itself (it is gone the moment the page is there): RouteBoxMark tells when it mounted, and the page that replaces it
// (RouteHold) keeps itself behind an ordinary loading box for the rest of the 500 ms minimum, so the two read as one loading screen.
// kind: one of the four, so two cannot be asked for at once. full (the default) hides the page behind it.
const KIND_CLASS = { full: "loading-full ", delayed: "page-loading ", cover: "", route: "loading-route " } as const
export type LoadingKind = keyof typeof KIND_CLASS

export function LoadingBox({ kind = "full" }: { kind?: LoadingKind }) {
  return (
    <div role="status" aria-label="Loading" className={`${KIND_CLASS[kind]}pointer-events-none fixed inset-0 z-[100] flex items-center justify-center bg-background`}>
      <div data-loading="true" className="loading-box relative h-12 w-56 overflow-hidden border-2 border-foreground text-foreground" />
    </div>
  )
}
