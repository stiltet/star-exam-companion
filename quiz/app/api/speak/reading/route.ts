import { READING_POOL } from "@/lib/say"
import { speakHandler } from "@/lib/speak-route"

// Read Aloud's voice: the same checks as /api/speak, but clips go to their own pool, so reading
// the courses never evicts a Voice Quiz clip.
export const POST = speakHandler(READING_POOL)
