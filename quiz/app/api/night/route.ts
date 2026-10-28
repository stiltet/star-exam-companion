import { nightStatusResponse } from "@/lib/night-build"

export const dynamic = "force-dynamic"

export function GET(request: Request) {
  return nightStatusResponse(request)
}
