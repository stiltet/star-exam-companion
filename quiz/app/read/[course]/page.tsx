import { notFound } from "next/navigation"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { ActionLink } from "@/components/atoms/button"
import { Breadcrumb } from "@/components/atoms/breadcrumb"
import { Heading } from "@/components/atoms/heading"
import { Text } from "@/components/atoms/text"
import { courseBundle } from "@/lib/course-text"
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
      <div className="min-h-screen flex flex-col">
        <SiteHeader />
        <main className="flex-1 max-w-4xl mx-auto px-4 pt-6 pb-6 w-full">
          <Breadcrumb back={{ href: "/read", label: "READ ALOUD" }} current={`COURSE ${noText.id}`} placement="pb-2" />
          <PageNav kind="course" previous={previous} next={next} placement="mt-4 mb-6" />
          <Heading variant="title" placement="mb-6">{noText.title}</Heading>
          <Text variant="muted" placement="mb-6">{noText.why}</Text>
          <ActionLink variant="filled" href={`https://www.skills.google/course_templates/${noText.template}`} newTab>OPEN ON GOOGLE SKILLS</ActionLink>
          <PageNav kind="course" previous={previous} next={next} placement="mt-6" />
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
      <main className="flex-1 max-w-4xl mx-auto px-4 pt-6 pb-6 w-full">
        <Breadcrumb back={{ href: "/read", label: "READ ALOUD" }} current={`COURSE ${course.id}`} placement="pb-2" />
        <PageNav kind="course" previous={previous} next={next} placement="mt-4 mb-6" />
        <Heading variant="title" placement="mb-6">{course.title}</Heading>
        {loaded.ok ? (
          <ReadingList course={course.id} pages={loaded.pages} />
        ) : (
          <CourseTextError detail={loaded.error} again={`/read/${course.id}`} />
        )}
        <PageNav kind="course" previous={previous} next={next} placement="mt-6" />
      </main>
      <SiteFooter />
    </div>
  )
}
