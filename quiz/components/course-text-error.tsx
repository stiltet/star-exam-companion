import Link from "next/link"

// The course text could not be read from Google: a plain sentence, two ways on, and the reason
// as detail for whoever looks into it.
export function CourseTextError({ detail, again }: { detail: string; again: string }) {
  return (
    <div className="flex flex-col gap-4">
      <p role="alert" className="font-bold">Google did not send the course text just now. Try again in a minute.</p>
      <div className="flex flex-wrap gap-3">
        <Link href={again} className="border-2 border-foreground px-4 py-2 no-underline bg-foreground text-background hover:opacity-80">
          TRY AGAIN
        </Link>
        <Link href="/read" className="border-2 border-foreground px-4 py-2 no-underline hover:bg-foreground hover:text-background">
          ALL COURSES
        </Link>
      </div>
      <p className="text-sm text-muted-foreground">Detail: {detail}</p>
    </div>
  )
}
