// Where Back goes when there is no earlier page in this app to return to: one level up.
// /study/a/b -> /study/a -> /study -> /. Home has no parent.
export function parentPath(pathname: string): string | null {
  const parts = pathname.split("/").filter(Boolean)
  if (parts.length === 0) return null
  return parts.length === 1 ? "/" : `/${parts.slice(0, -1).join("/")}`
}
