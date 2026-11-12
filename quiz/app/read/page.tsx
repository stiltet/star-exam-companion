import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { ActionLink } from "@/components/atoms/button"
import { Text } from "@/components/atoms/text"
import { Heading } from "@/components/atoms/heading"
import { CourseCard } from "@/components/reading-progress"
import { FinishReadingNote } from "@/components/finish-reading-note"
import { courseBundle } from "@/lib/reading-provider"
import { readingCompletion } from "@/lib/reading-completion"
import { activePack } from "@/lib/pack"

export const dynamic = "force-dynamic"

export default async function ReadPage() {
  // Each course's number of readings, so the list can say done or in progress. The bundles are
  // kept a day on the Mac; a course Google does not send just shows without its total.
  const pack = activePack()
  const courses = pack.courses
  const loaded = await Promise.all(courses.map((course) => courseBundle(course)))
  const completion = readingCompletion(pack, loaded)
  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 max-w-4xl mx-auto px-4 py-8 w-full">
        <Heading variant="page" placement="sr-only">Read Aloud</Heading>
        {!pack.meta.reading && (
          <>
            <Text variant="muted" placement="mb-6">Read Aloud has no course for {pack.meta.title} yet: this exam has no readable course text in the quiz. The official learning path is on Google Skills.</Text>
            <ActionLink variant="filled" href={pack.meta.learningPath} newTab>OFFICIAL LEARNING PATH</ActionLink>
          </>
        )}
        {completion.notice && <Text variant="notice" role="status" placement="mb-6">{completion.notice}</Text>}
        {completion.notice && courses.some((course) => course.provider === "private") && <FinishReadingNote />}
        {pack.meta.reading && <Text variant="muted" placement="mb-6">Public learning-path readings and private copies saved on this server, read aloud in the Mac&apos;s voice. Pick a course.</Text>}
        {pack.meta.reading && <div className="divide-y-2 divide-foreground border-2 border-foreground">
          {/* One list in course order: a course with no reading text keeps its place and says why. */}
          {[
            ...courses.map((course, index) => ({ number: Number(course.id), course, index, none: undefined })),
            ...pack.noReading.map((none) => ({ number: Number(none.id), course: undefined, index: -1, none })),
          ].sort((a, b) => a.number - b.number).map(({ course, index, none }) => {
            if (none) return <CourseCard key={none.id} course={none.id} title={none.title} reason={none.why} noText />
            const result = loaded[index]
            return <CourseCard key={course.id} course={course.id} title={course.title} total={result?.ok ? result.pages.length : undefined} privateCopy={course.provider === "private" && result?.ok === true && result.pages.length > 0} />
          })}
        </div>}
        {pack.meta.reading && (
          <div className="mt-8">
            <ActionLink variant="outlined" placement="self-stretch" href="/read/night">Night reading</ActionLink>
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  )
}
