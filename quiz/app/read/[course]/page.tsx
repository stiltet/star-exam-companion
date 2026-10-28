import Link from "next/link"
import { notFound } from "next/navigation"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { courseBundle } from "@/lib/course-text"
import { CourseTextError } from "@/components/course-text-error"
import { ReadingList } from "@/components/reading-progress"
import { courseById } from "@/lib/reading"

export const dynamic = "force-dynamic"

type Props = { params: Promise<{ course: string }> }

export default async function CourseReadingsPage({ params }: Props) {
  const course = courseById((await params).course)
  if (!course) notFound()
  const loaded = await courseBundle(course)

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 max-w-4xl mx-auto px-4 py-8 w-full">
        <nav className="text-sm mb-6 text-muted-foreground">
          <Link href="/read">READ ALOUD</Link>
          <span className="mx-2">/</span>
          <span className="text-foreground">COURSE {course.id}</span>
        </nav>
        <h1 className="text-2xl font-bold mb-6">{course.title}</h1>
        {loaded.ok ? (
          <ReadingList course={course.id} pages={loaded.pages} />
        ) : (
          <CourseTextError detail={loaded.error} again={`/read/${course.id}`} />
        )}
      </main>
      <SiteFooter />
    </div>
  )
}
