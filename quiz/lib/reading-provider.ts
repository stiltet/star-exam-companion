import { courseBundle as loadGoogleCourse } from "./course-text.ts"
import type { Loaded } from "./course-text.ts"
import type { Course } from "./reading-view.ts"

export interface ReadingProvider {
  load(course: Course): Promise<Loaded>
}

export const googleReadingProvider: ReadingProvider = {
  load: loadGoogleCourse,
}

export function courseBundle(course: Course): Promise<Loaded> {
  return googleReadingProvider.load(course)
}
