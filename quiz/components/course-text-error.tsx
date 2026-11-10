import { ActionLink } from "@/components/atoms/button"
import { Text } from "@/components/atoms/text"
import { courseErrorMessage } from "@/lib/course-error"

// The course text could not be read: a plain sentence, two ways on, and the reason as detail for whoever looks into it.
// local: the copies are private files on this server, so the cause is there, not at Google.
export function CourseTextError({ detail, again, local }: { detail: string; again: string; local?: boolean }) {
  return (
    <div className="flex flex-col gap-4">
      <Text variant="strong" role="alert">{courseErrorMessage(detail, local === true)}</Text>
      <div className="flex flex-wrap gap-3">
        <ActionLink variant="filled" href={again}>TRY AGAIN</ActionLink>
        <ActionLink variant="outlined" href="/read">ALL COURSES</ActionLink>
      </div>
      <Text variant="note">Detail: {detail}</Text>
    </div>
  )
}
