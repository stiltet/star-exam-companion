import assert from "node:assert/strict"
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"
import type { PageShell } from "../components/organisms/page-shell.tsx"

// A server page cannot hand a function to the client breadcrumb, so the type refuses it (the build's type check runs this line).
type Trail = NonNullable<Parameters<typeof PageShell>[0]["breadcrumb"]>
// @ts-expect-error a crumb with an onClick is not allowed in a server page's trail
export const refused: Trail = [{ label: "FLASHCARDS", onClick: () => {} }]

// One layout for every page (owner, 17 Nov): a page gives its content to PageShell and never builds its own header, footer or
// container, and a loading screen is the app's loading box, never text of its own.
function files(dir: string, name: RegExp): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) return files(path, name)
    return name.test(entry) ? [path] : []
  })
}

const appDir = new URL("../app", import.meta.url).pathname

// What a page file must not contain, with what to do instead.
export function layoutProblems(source: string): string[] {
  const problems: string[] = []
  if (/<SiteHeader\b|<SiteFooter\b/.test(source)) problems.push("builds its own header or footer: use PageShell")
  if (/<main\b/.test(source)) problems.push("builds its own <main>: PageShell holds the container width and padding")
  if (/min-h-screen/.test(source)) problems.push("builds its own page wrapper: use PageShell")
  return problems
}

export function loadingProblems(source: string): string[] {
  return /<LoadingBox\b/.test(source) && !/>\s*[A-Za-z][^<{]*</.test(source) ? [] : ["a loading screen is <LoadingBox /> and nothing else, with no text of its own"]
}

test("a page file or a layout builds no header, footer, main or page wrapper of its own", () => {
  for (const file of files(appDir, /^(page|layout|not-found)\.tsx$/)) {
    if (file.endsWith("app/layout.tsx")) continue
    assert.deepEqual(layoutProblems(readFileSync(file, "utf8")), [], file)
  }
})

test("every loading.tsx is the app's loading box with no text of its own", () => {
  for (const file of files(appDir, /^loading\.tsx$/)) assert.deepEqual(loadingProblems(readFileSync(file, "utf8")), [], file)
})

test("the checks catch a bad example", () => {
  assert.equal(layoutProblems('<div className="min-h-screen flex flex-col"><SiteHeader /><main>x</main></div>').length, 3)
  assert.equal(loadingProblems("<p>Loading the course text from Google…</p>").length, 1)
  assert.deepEqual(loadingProblems("export default function L() { return <LoadingBox /> }"), [])
})

// Previous and Next are the app's one pair, StepNav (owner, 17 Nov): no component draws its own.
test("no component hand-draws a Previous or Next pair", () => {
  const dirs = [appDir, new URL("../components", import.meta.url).pathname]
  for (const dir of dirs) {
    for (const file of files(dir, /\.tsx$/)) {
      if (file.includes("/components/ui/") || file.endsWith("step-nav.tsx") || file.endsWith("voice-quiz.tsx")) continue
      assert.doesNotMatch(readFileSync(file, "utf8"), /←\s*(PREV|Prev)|(NEXT|Next)\s*→/, `${file} draws its own Previous or Next: use StepNav`)
    }
  }
})
