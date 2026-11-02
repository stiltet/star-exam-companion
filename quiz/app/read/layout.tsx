import { notFound } from "next/navigation"
import { connection } from "next/server"
import { activePack } from "@/lib/pack"
import { STATIC_DEMO } from "@/lib/static-demo"

// A pack with no course to read has no Read Aloud pages. Read for each request, since the exam can
// be switched while the quiz runs.
export default async function ReadLayout({ children }: { children: React.ReactNode }) {
  if (!STATIC_DEMO) await connection()
  if (!activePack().meta.reading) notFound()
  return children
}
