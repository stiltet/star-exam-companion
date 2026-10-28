import { nightAudioResponse } from "@/lib/night-build"

export const dynamic = "force-dynamic"

export function GET(request: Request, { params }: { params: Promise<{ key: string }> }) {
  return nightAudioResponse(request, params)
}
