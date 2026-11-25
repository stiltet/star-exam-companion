import Link from "next/link"
import { notFound } from "next/navigation"
import { PageShell } from "@/components/organisms/page-shell"
import { CourseTextError } from "@/components/course-text-error"
import { ReadAloud } from "@/components/read-aloud"
import { PageNav } from "@/components/page-nav"
import { ActionLink } from "@/components/atoms/button"
import { courseBundle } from "@/lib/reading-provider"
import { activePack } from "@/lib/pack"
import { courseById, nextReading, previousLesson, reading, reviewUrl } from "@/lib/reading"

export const dynamic = "force-dynamic"

type Props = { params: Promise<{ course: string; page: string }> }

export default async function ReadingPage({ params }: Props) {
  const { course: courseId, page: pageId } = await params
  const pack = activePack()
  const courses = pack.courses
  // The order /read lists: courses with text, then the ones without.
  const ordered = [...courses, ...pack.noReading]
  const course = courseById(courses, courseId)
  if (!course) notFound()
  const loaded = await courseBundle(course)

  if (!loaded.ok) {
    return (
      <PageShell>
        <>
          <CourseTextError detail={loaded.error} again={`/read/${course.id}/${pageId}`} problem={loaded.problem} />
        </>
      </PageShell>
    )
  }

  const page = reading(loaded.bundle, pageId)
  if (!page) notFound()
  const list = loaded.pages
  const at = list.findIndex((entry) => entry.id === pageId)
  // The reading on Google, where its review is done and its videos play.
  const google = reviewUrl(course, loaded.ids, list.length, at)
  // A private course's video opens the video lesson itself on Google Skills; its page id is the video's number.
  const watch = course.provider === "private" ? { url: `${course.path}/course_templates/${course.template}/video/${pageId}`, direct: true } : google
  const previous = previousLesson(course, list, pageId)
  const following = nextReading(course, list, pageId, ordered)

  return (
    <PageShell breadcrumb={[{ label: "READ ALOUD", href: "/read" }, { label: `COURSE ${course.id}`, href: `/read/${course.id}` }, { label: `${at + 1} of ${list.length}` }]} variant="reading">
      <>
        <PageNav kind="lesson" previous={previous} next={following} where="top" placement="mb-6" />
        <ReadAloud
          key={`${course.id}/${pageId}`}
          place={`${course.id}/${pageId}`}
          title={page.title}
          paragraphs={page.paragraphs}
          next={following}
          review={page.review ? google : null}
          reviewAt={page.reviewAt}
          video={page.videoAt.length > 0 ? watch : null}
          videoAt={page.videoAt}
        />
        {/* Every lesson can be opened on Google Skills, where it is ticked off and its videos play. */}
        <ActionLink variant="outlined" placement="mt-6 w-full" href={google.url} newTab>OPEN IN GOOGLE SKILLS</ActionLink>
        <PageNav kind="lesson" previous={previous} next={following} where="bottom" placement="mt-6" />
      </>
    </PageShell>
  )
}
