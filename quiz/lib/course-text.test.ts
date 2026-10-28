import assert from "node:assert/strict"
import test, { afterEach, beforeEach } from "node:test"
import { clearCourseCache, courseBundle, FAILED_MS, RETRY_MS } from "./course-text.ts"
import { COURSES } from "./reading.ts"

// fetch and the clock are stubbed: the tests never reach Google, and each starts from a cold cache.
const realFetch = globalThis.fetch
const realNow = Date.now
let clock = 1_000_000

beforeEach(() => {
  clearCourseCache()
  clock = 1_000_000
  Date.now = () => clock
})

afterEach(() => {
  globalThis.fetch = realFetch
  Date.now = realNow
})

const DAY_MS = 24 * 60 * 60 * 1000

function stubFetch(answer: (url: string) => Response | Promise<Response>): string[] {
  const asked: string[] = []
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(input)
    asked.push(url)
    return answer(url)
  }) as typeof fetch
  return asked
}

const course = COURSES[0]
const coursePage = `<a path="/course_templates/${course.template}/html_bundles/11"></a><a href="/course_templates/${course.template}/html_bundles/12"></a>`
const healthy = (url: string) => (url.includes("skills.google") ? new Response(coursePage) : Response.json([{ _id: url.split("/").pop() }]))

test("a course's four bundle files and its page are read once, then kept", async () => {
  const asked = stubFetch(healthy)
  const first = await courseBundle(course)
  assert.equal(first.ok, true)
  assert.equal(asked.length, 5)
  assert.deepEqual(asked.filter((url) => !url.startsWith("https://storage.googleapis.com/cloud-training/")), [`https://www.skills.google/course_templates/${course.template}`])
  if (first.ok) {
    assert.deepEqual(first.bundle.components, [{ _id: "components.json" }])
    assert.deepEqual(first.ids, ["11", "12"])
  }
  await courseBundle(course)
  assert.equal(asked.length, 5)
})

test("pages opened together share one load instead of each asking Google", async () => {
  const asked = stubFetch(healthy)
  const [one, two] = await Promise.all([courseBundle(course), courseBundle(course)])
  assert.equal(one.ok && two.ok, true)
  assert.equal(asked.length, 5)
})

test("after a day the course is read again, and a failed refresh serves yesterday's copy", async () => {
  stubFetch(healthy)
  await courseBundle(course)
  clock += DAY_MS + 1
  const asked = stubFetch(() => new Response("down", { status: 503 }))
  const stale = await courseBundle(course)
  assert.equal(stale.ok, true)
  if (stale.ok) assert.deepEqual(stale.ids, ["11", "12"])
  const tried = asked.length
  assert.ok(tried > 0)
  // The outage is not retried on every request: only after RETRY_MS.
  await courseBundle(course)
  assert.equal(asked.length, tried)
  clock += RETRY_MS
  await courseBundle(course)
  assert.ok(asked.length > tried)
})

test("a course page that cannot be reached leaves the ids empty, then is asked again after RETRY_MS", async () => {
  stubFetch((url) => {
    if (url.includes("skills.google")) throw new TypeError("fetch failed")
    return Response.json([])
  })
  const result = await courseBundle(course)
  assert.equal(result.ok, true)
  if (result.ok) assert.deepEqual(result.ids, [])
  const asked = stubFetch(healthy)
  const soon = await courseBundle(course)
  if (soon.ok) assert.deepEqual(soon.ids, [])
  assert.equal(asked.length, 0, "not asked again before RETRY_MS")
  clock += RETRY_MS
  const retried = await courseBundle(course)
  if (retried.ok) assert.deepEqual(retried.ids, ["11", "12"])
  assert.deepEqual(asked, [`https://www.skills.google/course_templates/${course.template}`], "only the course page is asked again")
})

test("one bundle file failing fails the course, with the reason", async () => {
  stubFetch((url) => (url.endsWith("blocks.json") ? new Response("gone", { status: 404 }) : healthy(url)))
  const result = await courseBundle(course)
  assert.equal(result.ok, false)
  if (!result.ok) assert.match(result.error, /404 for blocks\.json/)
})

test("a course never read that fails is not asked again for FAILED_MS, then is", async () => {
  const asked = stubFetch(() => new Response("down", { status: 503 }))
  assert.equal((await courseBundle(course)).ok, false)
  const tried = asked.length
  assert.equal((await courseBundle(course)).ok, false)
  assert.equal(asked.length, tried, "the outage answers at once, without another timeout")
  clock += FAILED_MS
  stubFetch(healthy)
  assert.equal((await courseBundle(course)).ok, true)
})

test("a bundle file that is not a list is refused", async () => {
  stubFetch((url) => (url.includes("skills.google") ? new Response(coursePage) : Response.json({ not: "a list" })))
  const result = await courseBundle(course)
  assert.equal(result.ok, false)
  if (!result.ok) assert.match(result.error, /not a list/)
})
