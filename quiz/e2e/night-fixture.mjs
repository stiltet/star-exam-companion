import { copyFile, mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { loadCourseParts, nightDirFor, scriptKey } from "../lib/night-build.ts"
import { chapterList, manifestRecord } from "../lib/night.ts"

// Seed only the external speech output; the server still loads each pack and runs its real Night routes.
export async function seedNight() {
  const silence = fileURLToPath(new URL("./silence.m4a", import.meta.url))
  for (const exam of ["generative-ai-leader", "agentic-architect"]) {
    const parts = await loadCourseParts(exam)
    if (parts.length === 0) throw new Error(`No synthetic Night readings for ${exam}`)
    const key = scriptKey(parts)
    const dir = path.join(nightDirFor(exam), key)
    const chapters = chapterList(parts, parts.map(() => 1 / parts.length))
    await mkdir(dir, { recursive: true })
    await copyFile(silence, path.join(dir, "night.m4a"))
    await writeFile(path.join(dir, "manifest.json"), manifestRecord(key, { duration: 1, chapters }))
  }
}
