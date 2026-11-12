import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { listPacks, loadPack } from "../lib/pack.ts"
import { itemsFromGlossary } from "../lib/round.ts"
import { parseGlossary } from "../lib/sources.ts"
import { voiceIndex } from "../lib/speak.ts"

export const silentWav = Buffer.from("UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=", "base64")

// Seed the external speech output, not the API: worker requests still validate real pack keys and cache real responses.
export async function seedVoice(root, dir) {
  await mkdir(dir, { recursive: true, mode: 0o700 })
  for (const { id } of listPacks(root)) {
    const pack = loadPack(root, id)
    const parsed = parseGlossary(pack.glossaryText)
    if (!parsed.ok) throw new Error(`Cannot seed voice clips for ${id}: its glossary does not parse`)
    const index = voiceIndex(itemsFromGlossary(parsed.glossary, pack.scenes))
    if (index.size === 0) throw new Error(`No voice clips to seed for ${id}`)
    // A bounded pool: one write per clip all at once could open more files than the system allows.
    const keys = [...index.keys()]
    for (let i = 0; i < keys.length; i += 32) {
      await Promise.all(keys.slice(i, i + 32).map((key) => writeFile(path.join(dir, `${key}.wav`), silentWav)))
    }
  }
}
