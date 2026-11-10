import { ActionLink } from "@/components/atoms/button"
import { Text } from "@/components/atoms/text"
import { courseErrorMessage, type CourseProblem } from "@/lib/course-error"

// The course text could not be read: a plain sentence, two ways on, and the reason as detail for whoever looks into it.
// problem: set for a private course, whose copies are files on this server, so the cause is there, not at Google.
export function CourseTextError({ detail, again, problem }: { detail: string; again: string; problem?: CourseProblem }) {
  return (
    <div className="flex flex-col gap-4">
      <Text variant="strong" role="alert">{courseErrorMessage(problem)}</Text>
      <div className="flex flex-wrap gap-3">
        <ActionLink variant="filled" href={again}>TRY AGAIN</ActionLink>
        <ActionLink variant="outlined" href="/read">ALL COURSES</ActionLink>
      </div>
      <Text variant="note">Detail: {detail}</Text>
    </div>
  )
}
