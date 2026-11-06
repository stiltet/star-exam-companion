import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { ActionLink } from "@/components/atoms/button"
import { Text } from "@/components/atoms/text"
import { Heading } from "@/components/atoms/heading"
import { CourseCard } from "@/components/reading-progress"
import { SendToStarSetup } from "@/components/send-to-star-setup"
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
        {pack.meta.reading && <Text variant="muted" placement="mb-6">Public learning-path readings and private copies saved on this server, read aloud in the Mac&apos;s voice. Pick a course.</Text>}
        {courses.some((course) => course.provider === "private") && <SendToStarSetup />}
        {pack.meta.reading && <div className="divide-y-2 divide-foreground border-2 border-foreground">
          {courses.map((course, index) => {
            const result = loaded[index]
            return <CourseCard key={course.id} course={course.id} title={course.title} total={result?.ok ? result.pages.length : undefined} privateCopy={course.provider === "private"} />
          })}
        </div>}
        {pack.noReading.length > 0 && <section className="mt-8" aria-labelledby="not-read-aloud">
          <Heading variant="label" id="not-read-aloud" placement="mb-4">Not read aloud</Heading>
          <div className="divide-y-2 divide-foreground border-2 border-foreground">
            {pack.noReading.map((course) => <CourseCard key={course.id} course={course.id} title={course.title} reason={course.why} noText />)}
          </div>
        </section>}
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
