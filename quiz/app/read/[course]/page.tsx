import Link from "next/link"
import { notFound } from "next/navigation"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { ActionLink } from "@/components/atoms/button"
import { Text } from "@/components/atoms/text"
import { courseBundle } from "@/lib/course-text"
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
          <nav className="text-sm mb-6 text-muted-foreground">
            <Link href="/read">READ ALOUD</Link>
            <span className="mx-2">/</span>
            <span className="text-foreground">COURSE {noText.id}</span>
          </nav>
          <h1 className="text-2xl font-bold mb-6">{noText.title}</h1>
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
