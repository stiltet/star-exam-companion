import Link from "next/link"
import { notFound } from "next/navigation"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { Text } from "@/components/atoms/text"
import { CourseTextError } from "@/components/course-text-error"
import { ReadAloud } from "@/components/read-aloud"
import { PageNav } from "@/components/atoms/page-nav"
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
      <div className="min-h-screen flex flex-col">
        <SiteHeader />
        <main className="flex-1 max-w-4xl mx-auto px-4 py-8 w-full">
          <CourseTextError detail={loaded.error} again={`/read/${course.id}/${pageId}`} problem={loaded.problem} />
        </main>
        <SiteFooter />
      </div>
    )
  }

  const page = reading(loaded.bundle, pageId)
  if (!page) notFound()
  const list = loaded.pages
  const at = list.findIndex((entry) => entry.id === pageId)
  // The reading on Google, where its review is done and its videos play.
  const google = reviewUrl(course, loaded.ids, list.length, at)
  const previous = previousLesson(course, list, pageId)
  const following = nextReading(course, list, pageId, ordered)

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      {/* Only the course links stay put. The title row above scrolls away. */}
      <div data-read-sticky className="sticky top-0 z-40 w-full bg-background">
        <nav className="max-w-4xl mx-auto px-4 pt-3 pb-2 text-sm text-muted-foreground">
          <Link href="/read">READ ALOUD</Link>
          <span className="mx-2">/</span>
          <Link href={`/read/${course.id}`}>COURSE {course.id}</Link>
          <span className="mx-2">/</span>
          <span className="text-foreground">{at + 1} of {list.length}</span>
        </nav>
      </div>
      <main className="flex-1 max-w-4xl mx-auto px-4 pb-8 w-full">
        <PageNav kind="lesson" previous={previous} next={following} placement="mb-4" />
        {course.provider === "private" && (
          <Text variant="note" placement="mb-4">This reading is from a private copy on this server.</Text>
        )}
        <ReadAloud
          key={`${course.id}/${pageId}`}
          place={`${course.id}/${pageId}`}
          title={page.title}
          paragraphs={page.paragraphs}
          next={following}
          review={page.review ? google : null}
          reviewAt={page.reviewAt}
          video={page.videoAt.length > 0 ? google : null}
          videoAt={page.videoAt}
        />
        <PageNav kind="lesson" previous={previous} next={following} placement="mt-8" />
      </main>
      <SiteFooter />
    </div>
  )
}
