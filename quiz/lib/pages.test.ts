import assert from "node:assert/strict"
import test from "node:test"
import { phoneTitle, sitePages } from "./pages.ts"

const SITE_PAGES = sitePages({ exam: { questions: 60, minutes: 90 } })

test("the page list is the menu order, and Read Aloud is in it", () => {
  assert.deepEqual(SITE_PAGES.map((page) => page.href), [
    "/study", "/practice", "/voice", "/read", "/exam", "/flashcards", "/glossary", "/progress",
  ])
  assert.equal(SITE_PAGES.find((page) => page.href === "/read")?.menu, "READ ALOUD")
})

test("the exam's blurb names the question count the exam asks", () => {
  assert.match(SITE_PAGES.find((page) => page.href === "/exam")?.blurb ?? "", /\b60 questions/)
  const agentic = sitePages({ exam: { questions: 80, minutes: 180 } })
  assert.match(agentic.find((page) => page.href === "/exam")?.blurb ?? "", /180 min, 80 questions/)
})

test("the phone title comes from the page list, Study's own phone title included", () => {
  assert.equal(phoneTitle("/study"), "Study Sections")
  assert.equal(phoneTitle("/voice"), "Voice Quiz")
  assert.equal(phoneTitle("/read"), "Read Aloud")
  assert.equal(phoneTitle("/read/night"), "Night reading")
  assert.equal(phoneTitle("/read/1/2"), "Read Aloud")
  assert.equal(phoneTitle("/study/2"), "Study")
  assert.equal(phoneTitle("/about"), "About")
  assert.equal(phoneTitle("/nowhere"), "Star Exam Companion")
  for (const page of SITE_PAGES) assert.equal(phoneTitle(page.href), page.phone ?? page.title)
})

test("a pack with no course to read still lists Read Aloud, so the page can say there is none", () => {
  const pages = sitePages({ exam: { questions: 80, minutes: 180 } }).map((page) => page.href)
  assert.deepEqual(pages, ["/study", "/practice", "/voice", "/read", "/exam", "/flashcards", "/glossary", "/progress"])
})
