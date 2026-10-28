import { VOICE_POOL } from "@/lib/say"
import { speakHandler } from "@/lib/speak-route"

// The Voice Quiz's voice: a line the quiz did not write itself, spoken into the quiz's own pool.
export const POST = speakHandler(VOICE_POOL)
