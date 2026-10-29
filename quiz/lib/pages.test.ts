import assert from "node:assert/strict"
import test from "node:test"
import { phoneTitle, SITE_PAGES } from "./pages.ts"
import { MAX_EXAM_QUESTIONS } from "./score.ts"

test("the page list is the menu order, and Read Aloud is in it", () => {
  assert.deepEqual(SITE_PAGES.map((page) => page.href), [
    "/study", "/practice", "/voice", "/read", "/exam", "/flashcards", "/glossary", "/progress",
  ])
  assert.equal(SITE_PAGES.find((page) => page.href === "/read")?.menu, "READ ALOUD")
})

test("the exam's blurb names the question count the exam asks", () => {
  assert.match(SITE_PAGES.find((page) => page.href === "/exam")?.blurb ?? "", new RegExp(`\\b${MAX_EXAM_QUESTIONS} questions`))
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
