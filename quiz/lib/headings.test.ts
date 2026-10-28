import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

// The components are .tsx, which node --test does not load, so these read their source, as
// speak-route.test.ts does. Their look and behaviour are proven in the browser at 375 and 390 px.
function source(file: string): string {
  return readFileSync(new URL(`../components/${file}`, import.meta.url), "utf8")
}

test("Read Aloud's Next is a section heading that names the link it holds", () => {
  const read = source("read-aloud.tsx")
  assert.match(read, /<nav aria-labelledby=\{nextId\}[^>]*>\s*\{\(reviewAtEnd \|\| videoAtEnd\) && <Divider \/>\}\s*<Heading variant="section" id=\{nextId\}>Next:<\/Heading>\s*<ActionLink[^>]*href=\{next\.href\}/)
  assert.match(read, /const nextId = useId\(\)/)
  const atom = source("atoms/heading.tsx")
  assert.match(atom, /section: "text-center text-3xl font-bold m-0 leading-none"/)
  assert.match(atom, /<Tag id=\{id\}/)
  assert.match(atom, /variant === "title" \|\| variant === "page" \? "h1" : "h2"/, "a reading title and a page heading are h1s")
})

test("Previous section and Next section sit beside the section title and move focus to the question heading", () => {
  const quiz = source("voice-quiz.tsx")
  assert.match(quiz, /<ControlButton key="previous-section"[^\n]*openSection\(jumps\.previous\)/)
  assert.match(quiz, /<ControlButton key="next-section"[^\n]*openSection\(jumps\.next\)/)
  assert.match(quiz, /aria-label="Previous section"/)
  assert.match(quiz, /aria-label="Next section"/)
  assert.match(quiz, /<Heading variant="group" placement="px-16 sm:px-44">/)
  assert.doesNotMatch(quiz, /Previous course|Next course|Chapter /)
  assert.match(quiz, /function openSection\([^)]*\) \{\s*if \(target === null\) return\s*focusQuestion\.current = true/)
  assert.match(quiz, /<Heading variant="chapter" placement="mb-4" ref=\{questionHeading\}>/)
  assert.match(quiz, /questionHeading\.current\?\.focus\(\{ preventScroll: true \}\)/)
  assert.doesNotMatch(quiz, /<h2 className=/, "the question line is the heading atom, not a hand-styled h2")
  const atom = source("atoms/heading.tsx")
  assert.match(atom, /group: "text-center font-bold m-0"/)
  assert.match(atom, /tabIndex=\{ref \? -1 : undefined\}/, "a heading given a ref can take focus without joining the tab order")
})

test("the night player speaks a new chapter, the store and a recovered Play, and keeps focus", () => {
  const night = source("night-reader.tsx")
  assert.match(night, /<span role="status">\{chapter \?/, "only the chapter sentence is live")
  assert.match(night, /<\/span> \{clock\(at\)\}/, "the clock sits outside the live region")
  assert.match(night, /\{storing && <p role="status">/, "a store in progress is a status")
  assert.match(night, /setPlaying\(true\)\s*setNote\(null\)/, "a Play that works clears the old error")
  assert.match(night, /focusPlay\.current = true\s*setStored\(next\)/)
  assert.match(night, /playButton\.current\?\.focus\(\)/)
  assert.match(night, /<ActionButton ref=\{playButton\}/)
})

test("the night page says the Mac is preparing only while it builds, not while it checks", () => {
  const night = source("night-reader.tsx")
  assert.match(night, /const preparing = remote\?\.state === "building"\n/)
  assert.doesNotMatch(night, /"checking"/, "the page has no line for checking")
})
