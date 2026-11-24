import { notFound } from "next/navigation"
import { PageShell } from "@/components/organisms/page-shell"
import { ActionLink } from "@/components/atoms/button"
import { Heading } from "@/components/atoms/heading"
import { Text } from "@/components/atoms/text"
import { courseBundle } from "@/lib/reading-provider"
import { CourseTextError } from "@/components/course-text-error"
import { ReadingList } from "@/components/reading-progress"
import { activePack } from "@/lib/pack"
import { PageNav } from "@/components/page-nav"
import { courseById, courseNeighbours } from "@/lib/reading"

export const dynamic = "force-dynamic"

type Props = { params: Promise<{ course: string }> }

export default async function CourseReadingsPage({ params }: Props) {
  const pack = activePack()
  const id = (await params).course
  const { previous, next } = courseNeighbours([...pack.courses, ...pack.noReading], id)
  const course = courseById(pack.courses, id)
  // A course of the path with no text: its page says why and sends the reader to the official course.
  const noText = pack.noReading.find((entry) => entry.id === id)
  if (!course && noText) {
    return (
      <PageShell breadcrumb={[{ label: "READ ALOUD", href: "/read" }, { label: `COURSE ${noText.id}` }]} variant="reading">
        <PageNav kind="course" previous={previous} next={next} placement="mb-6" />
        <Heading variant="title" placement="mb-6">{noText.title}</Heading>
        <Text variant="muted" placement="mb-6">{noText.why}</Text>
        <ActionLink variant="filled" href={`https://www.skills.google/course_templates/${noText.template}`} newTab>OPEN ON GOOGLE SKILLS</ActionLink>
        <PageNav kind="course" previous={previous} next={next} placement="mt-6" />
      </PageShell>
    )
  }
  if (!course) notFound()
  const loaded = await courseBundle(course)

  return (
    <PageShell breadcrumb={[{ label: "READ ALOUD", href: "/read" }, { label: `COURSE ${course.id}` }]} variant="reading">
      <PageNav kind="course" previous={previous} next={next} placement="mb-6" />
      <Heading variant="title" placement="mb-6">{course.title}</Heading>
      {course.provider === "private" && (
        <Text variant="note" placement="mb-6">This course is read from private copies saved only on this server and on your devices for offline use. Night reading includes them too. They are never part of the project&apos;s files or the online demo.</Text>
      )}
      {loaded.ok && loaded.orderUnchecked && (
        <Text variant="note" placement="mb-6">Order not checked against Google yet: run pnpm reading:crawl so the lessons follow Google&apos;s page.</Text>
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
      <PageNav kind="course" previous={previous} next={next} placement="mt-6" />
    </PageShell>
  )
}
