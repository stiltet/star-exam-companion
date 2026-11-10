import Link from "next/link"
import { notFound } from "next/navigation"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { Text } from "@/components/atoms/text"
import { CourseTextError } from "@/components/course-text-error"
import { ReadAloud } from "@/components/read-aloud"
import { courseBundle } from "@/lib/reading-provider"
import { activePack } from "@/lib/pack"
import { courseById, nextReading, reading, reviewUrl } from "@/lib/reading"

export const dynamic = "force-dynamic"

type Props = { params: Promise<{ course: string; page: string }> }

export default async function ReadingPage({ params }: Props) {
  const { course: courseId, page: pageId } = await params
  const courses = activePack().courses
  const course = courseById(courses, courseId)
  if (!course) notFound()
  const loaded = await courseBundle(course)

  if (!loaded.ok) {
    return (
      <div className="min-h-screen flex flex-col">
        <SiteHeader />
        <main className="flex-1 max-w-4xl mx-auto px-4 py-8 w-full">
          <CourseTextError detail={loaded.error} again={`/read/${course.id}/${pageId}`} local={course.provider === "private"} />
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
        {course.provider === "private" && (
          <Text variant="note" placement="mb-4">This reading is from a private copy on this server.</Text>
        )}
        <ReadAloud
          key={`${course.id}/${pageId}`}
          place={`${course.id}/${pageId}`}
          title={page.title}
          paragraphs={page.paragraphs}
          next={nextReading(course, list, pageId, courses)}
          review={page.review ? google : null}
          reviewAt={page.reviewAt}
          video={page.videoAt.length > 0 ? google : null}
          videoAt={page.videoAt}
        />
      </main>
      <SiteFooter />
    </div>
  )
}
