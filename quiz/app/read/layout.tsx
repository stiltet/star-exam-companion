import { connection } from "next/server"
import { STATIC_DEMO } from "@/lib/static-demo"

// Read for each request, since the exam can be switched while the quiz runs. An exam with no course to
// read still has its Read Aloud page, which says so (owner, 3 Nov), so this guards nothing.
export default async function ReadLayout({ children }: { children: React.ReactNode }) {
  if (!STATIC_DEMO) await connection()
  return children
}
