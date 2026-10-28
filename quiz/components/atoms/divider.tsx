// The quiz's divider atom: the one line that separates parts of a page. Its look lives
// here; a parent places it, with gap or margin, and never restyles it.
export function Divider() {
  return <hr className="m-0 border-0 border-t-2 border-foreground" />
}
