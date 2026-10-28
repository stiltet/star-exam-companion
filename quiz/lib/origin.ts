// The only names this Mac answers to: localhost, plus QUIZ_LAN_HOST when it is set, the name or
// address a phone opens on the home network (docs/https.md). A page elsewhere can rebind its own
// DNS name to this Mac, and then its Host and Origin agree; checking the name, not only the
// match, refuses it.
export function allowedHostnames(lanHost = process.env.QUIZ_LAN_HOST): Set<string> {
  const names = new Set(["localhost", "127.0.0.1", "[::1]"])
  const lan = lanHost?.trim().toLowerCase()
  if (lan) names.add(lan)
  return names
}

export const ALLOWED_HOSTNAMES = allowedHostnames()

// Never a real origin, so a same-origin check against it always fails.
export const REFUSED_ORIGIN = "refused:"

// True when the request comes from a page on one of this Mac's names. Routes check this before
// reading a body, so a refused request costs no more than its headers.
export function sameOrigin(request: Request): boolean {
  return request.headers.get("origin") === browserOrigin(request)
}

// The origin a same-origin request from a browser on an allowed host carries, else REFUSED_ORIGIN.
export function browserOrigin(request: Request): string {
  const host = request.headers.get("host") ?? new URL(request.url).host
  const proto = request.headers.get("x-forwarded-proto") ?? "http"
  if (proto !== "http" && proto !== "https") return REFUSED_ORIGIN
  let hostname: string
  try {
    hostname = new URL(`${proto}://${host}`).hostname
  } catch {
    // A Host header that does not parse cannot be one of ours.
    return REFUSED_ORIGIN
  }
  if (!ALLOWED_HOSTNAMES.has(hostname)) return REFUSED_ORIGIN
  return `${proto}://${host}`
}
