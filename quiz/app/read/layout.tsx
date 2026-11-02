import { notFound } from "next/navigation"
import { BUILT_READING } from "@/lib/scope"

// A pack with no course to read has no Read Aloud pages.
export default function ReadLayout({ children }: { children: React.ReactNode }) {
  if (!BUILT_READING) notFound()
  return children
}
