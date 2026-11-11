import assert from "node:assert/strict"
import test from "node:test"
import { BUNDLE_BASE, coursesFile, pathAddress, pathCourses, type PathCard } from "./reading-path.ts"

// Every address, title and number below is made up.
const SITE = "https://www.skills.google"

test("a learning path is given as a whole address or as its number, and anything else is refused", () => {
  assert.equal(pathAddress("https://www.skills.google/paths/4525", SITE), "https://www.skills.google/paths/4525")
  assert.equal(pathAddress("  https://www.skills.google/paths/4525/?utm=x ", SITE), "https://www.skills.google/paths/4525")
  assert.equal(pathAddress("4525", SITE), "https://www.skills.google/paths/4525")
  assert.equal(pathAddress("https://evil.example/paths/4525", SITE), null)
  assert.equal(pathAddress("https://www.skills.google/catalog", SITE), null)
  assert.equal(pathAddress("not an address", SITE), null)
  assert.equal(pathAddress("", SITE), null)
})

test("the courses of a path come back in Google's order, numbered from one, and only the courses", () => {
  const cards: PathCard[] = [
    { type: "course", title: "First made-up course", href: "/paths/9/course_templates/111" },
    { type: "credential", title: "A badge", href: "/public_profiles/1" },
    { type: "course", title: " Second made-up course ", href: "/paths/9/course_templates/222?x=1" },
    { type: "course", title: "First made-up course", href: "/paths/9/course_templates/111" },
    { type: "course", title: "Course with no address", href: "" },
    { type: "course", title: "", href: "/paths/9/course_templates/333" },
    { type: "course", title: "Third made-up course", href: "https://www.skills.google/course_templates/444" },
  ]
  assert.deepEqual(pathCourses(cards), [
    { id: "1", template: "111", title: "First made-up course", provider: "private" },
    { id: "2", template: "222", title: "Second made-up course", provider: "private" },
    { id: "3", template: "444", title: "Third made-up course", provider: "private" },
  ])
  assert.deepEqual(pathCourses([]), [])
})

test("the courses file names the path, the bundle folder and the courses", () => {
  const courses = pathCourses([{ type: "course", title: "Only made-up course", href: "/course_templates/5" }])
  assert.deepEqual(coursesFile("https://www.skills.google/paths/9", courses), {
    path: "https://www.skills.google/paths/9",
    bundleBase: BUNDLE_BASE,
    courses: [{ id: "1", template: "5", title: "Only made-up course", provider: "private" }],
  })
  assert.ok(BUNDLE_BASE.startsWith("https://storage.googleapis.com/"), "the pack format accepts it")
})
