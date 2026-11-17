import { LoadingBox } from "@/components/atoms/loading-box"

// Shown while a course is fetched from Google, which can take several seconds the first time.
// The app's one loading screen, the same box as every other page, with no text of its own.
export default function ReadLoading() {
  return <LoadingBox />
}
