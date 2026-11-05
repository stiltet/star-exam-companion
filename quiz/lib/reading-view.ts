// A course and its source locations, as the active exam pack lists them.
export type Course = {
  id: string
  template: string
  title: string
  folder: string
  format?: "rise"
  bundleBase: string
  path: string
}

export type PageSummary = { id: string; title: string }

export type Paragraph = { text: string; heading: boolean; lead?: string; bullet?: true }

export type Reading = { title: string; paragraphs: Paragraph[]; review: boolean; reviewAt: number[]; videoAt: number[] }

// Where the review button sits and the voice stops: before the paragraph the review stood before
// on Google. A review at the very start or end keeps the button at the end, with no stop.
export function reviewStop(review: boolean, reviewAt: number | null, count: number): number | null {
  return review && reviewAt !== null && reviewAt > 0 && reviewAt < count ? reviewAt : null
}