import { notFound } from "next/navigation"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { ActionLink } from "@/components/atoms/button"
import { Breadcrumb } from "@/components/atoms/breadcrumb"
import { Heading } from "@/components/atoms/heading"
import { Text } from "@/components/atoms/text"
import { courseBundle } from "@/lib/reading-provider"
import { CourseTextError } from "@/components/course-text-error"
import { ReadingList } from "@/components/reading-progress"
import { activePack } from "@/lib/pack"
import { courseById } from "@/lib/reading"

export const dynamic = "force-dynamic"

type Props = { params: Promise<{ course: string }> }

export default async function CourseReadingsPage({ params }: Props) {
  const pack = activePack()
  const id = (await params).course
  const course = courseById(pack.courses, id)
  // A course of the path with no text: its page says why and sends the reader to the official course.
  const noText = pack.noReading.find((entry) => entry.id === id)
  if (!course && noText) {
    return (
      <div className="min-h-screen flex flex-col">
        <SiteHeader />
        <main className="flex-1 max-w-4xl mx-auto px-4 py-8 w-full">
          <Breadcrumb back={{ href: "/read", label: "READ ALOUD" }} current={`COURSE ${noText.id}`} placement="mb-6" />
          <Heading variant="page" placement="mb-6">{noText.title}</Heading>
          <Text variant="muted" placement="mb-6">{noText.why}</Text>
          <ActionLink variant="filled" href={`https://www.skills.google/course_templates/${noText.template}`} newTab>OPEN ON GOOGLE SKILLS</ActionLink>
        </main>
        <SiteFooter />
      </div>
    )
  }
  if (!course) notFound()
  const loaded = await courseBundle(course)

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 max-w-4xl mx-auto px-4 py-8 w-full">
        <Breadcrumb back={{ href: "/read", label: "READ ALOUD" }} current={`COURSE ${course.id}`} placement="mb-6" />
        <Heading variant="page" placement="mb-6">{course.title}</Heading>
        {course.provider === "private" && (
          <Text variant="note" placement="mb-6">This course is read from private copies saved only on this server and on your devices for offline use. Night reading includes them too. They are never part of the project's files or the online demo.</Text>
        )}
        {loaded.ok ? (
          <ReadingList
            course={course.id}
            pages={loaded.pages}
            emptyLabel={course.provider === "private"
              ? "No private copy is saved on this server yet."
              : undefined}
          />
        ) : (
          <CourseTextError detail={loaded.error} again={`/read/${course.id}`} problem={loaded.problem} />
        )}
        {course.provider === "private" && (
          <ActionLink variant="filled" placement="mt-6" href={`https://www.skills.google/course_templates/${course.template}`} newTab>OPEN ON GOOGLE SKILLS</ActionLink>
        )}
      </main>
      <SiteFooter />
    </div>
  )
}
