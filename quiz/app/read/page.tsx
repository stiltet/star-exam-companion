import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { ActionLink } from "@/components/atoms/button"
import { CourseCard } from "@/components/reading-progress"
import { courseBundle } from "@/lib/course-text"
import { COURSES } from "@/lib/reading-view"

export const dynamic = "force-dynamic"

export default async function ReadPage() {
  // Each course's number of readings, so the list can say done or in progress. The bundles are
  // kept a day on the Mac; a course Google does not send just shows without its total.
  const loaded = await Promise.all(COURSES.map((course) => courseBundle(course)))
  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 max-w-4xl mx-auto px-4 py-8 w-full">
        <h1 className="sr-only text-2xl font-bold mb-4">Read Aloud</h1>
        <p className="mb-6">The official learning path&apos;s readings, read aloud in the Mac&apos;s voice. Pick a course.</p>
        <div className="divide-y-2 divide-foreground border-2 border-foreground">
          {COURSES.map((course, index) => {
            const result = loaded[index]
            return <CourseCard key={course.id} course={course.id} title={course.title} total={result?.ok ? result.pages.length : undefined} />
          })}
        </div>
        <div className="mt-8">
          <ActionLink variant="outlined" placement="self-stretch" href="/read/night">Night reading</ActionLink>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
