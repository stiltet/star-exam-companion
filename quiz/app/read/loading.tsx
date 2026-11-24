import { LoadingBox } from "@/components/atoms/loading-box"

// Shown while a course is fetched from Google, which can take several seconds the first time. The same loading
// screen as everywhere else, and no text from the course or about it: nothing but the app's own box until the page is there.
export default function ReadLoading() {
  return <LoadingBox route />
}
