import assert from "node:assert/strict"
import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import test, { after } from "node:test"
import { MAX_RECORDS_PER_COURSE, readPrivateReadings, savePrivateReading } from "./private-reading.ts"
import { postPrivateReading } from "./private-reading-route.ts"
import { whileServing } from "./test-pack.ts"

const scratch = mkdtempSync(path.join(tmpdir(), "quiz-private-reading-route-"))
const before = {
  cwd: process.cwd(),
  exam: process.env.QUIZ_EXAM,
  setting: process.env.QUIZ_EXAM_SETTING_FILE,
  privateDir: process.env.QUIZ_PRIVATE_DIR,
}
const quiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
process.chdir(quiz)
process.env.QUIZ_EXAM_SETTING_FILE = path.join(scratch, "missing-active-exam.json")
process.env.QUIZ_PRIVATE_DIR = path.join(scratch, "private-store")
after(() => {
  process.chdir(before.cwd)
  if (before.exam === undefined) delete process.env.QUIZ_EXAM
  else process.env.QUIZ_EXAM = before.exam
  if (before.setting === undefined) delete process.env.QUIZ_EXAM_SETTING_FILE
  else process.env.QUIZ_EXAM_SETTING_FILE = before.setting
  if (before.privateDir === undefined) delete process.env.QUIZ_PRIVATE_DIR
  else process.env.QUIZ_PRIVATE_DIR = before.privateDir
  rmSync(scratch, { recursive: true, force: true })
})

const body = {
  template: "1385",
  pageId: "9001",
  title: "Synthetic reading title",
  text: "Synthetic captured paragraph.",
}
const request = (value: unknown = body, origin = "http://localhost", extra: Record<string, string> = {}) => new Request("http://localhost/api/reading/private", {
  method: "POST",
  headers: { host: "localhost", origin, "content-type": "application/json", "x-quiz-exam": "agentic-architect", ...extra },
  body: JSON.stringify(value),
})

test("the API route exports the handler these tests exercise", () => {
  assert.equal(
    readFileSync(path.join(quiz, "app/api/reading/private/route.ts"), "utf8").trim(),
    'export { postPrivateReading as POST } from "@/lib/private-reading-route"',
  )
})

test("a same-origin request saves only to a configured private course", async () => {
  const response = await whileServing("agentic-architect", () => postPrivateReading(request()))
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { ok: true, pageId: body.pageId })
  const saved = await readPrivateReadings("agentic-architect", "8")
  assert.equal(saved.length, 1)
  assert.deepEqual({ pageId: saved[0]?.pageId, title: saved[0]?.title, text: saved[0]?.text }, {
    pageId: body.pageId,
    title: body.title,
    text: body.text,
  })
  assert.match(saved[0]?.savedAt ?? "", /^\d{4}-\d\d-\d\dT/)
})

test("foreign origins, stale exams, courses the pack does not save and invalid payloads are refused", async () => {
  const before = await readPrivateReadings("agentic-architect", "8")
  const refused = await whileServing("agentic-architect", async () => {
    const foreign = await postPrivateReading(request(body, "http://other.example"))
    const stale = await postPrivateReading(request(body, "http://localhost", { "x-quiz-exam": "generative-ai-leader" }))
    const publicCourse = await postPrivateReading(request({ ...body, template: "9999" }))
    const extraKey = await postPrivateReading(request({ ...body, other: "value" }))
    const invalidText = await postPrivateReading(request({ ...body, text: "  " }))
    const badContentType = await postPrivateReading(new Request("http://localhost/api/reading/private", {
      method: "POST",
      headers: { host: "localhost", origin: "http://localhost", "content-type": "text/plain", "x-quiz-exam": "agentic-architect" },
      body: JSON.stringify(body),
    }))
    return { foreign, stale, publicCourse, extraKey, invalidText, badContentType }
  })
  assert.equal(refused.foreign.status, 400)
  assert.equal(refused.stale.status, 409)
  assert.equal(refused.publicCourse.status, 400)
  assert.equal(refused.extraKey.status, 400)
  assert.equal(refused.invalidText.status, 400)
  assert.equal(refused.badContentType.status, 400)
  assert.deepEqual(await readPrivateReadings("agentic-architect", "8"), before)
})

test("private input rejects JSON records larger than the store can safely read back", async () => {
  const before = await readPrivateReadings("agentic-architect", "8")
  const tooLarge = { ...body, text: "\u0000".repeat(1_000_000) }
  const response = await whileServing("agentic-architect", () => postPrivateReading(request(tooLarge)))
  assert.equal(response.status, 400)
  assert.deepEqual(await readPrivateReadings("agentic-architect", "8"), before)
})

test("a full course answers 413 with the reason, and an existing page can still be replaced", async () => {
  for (let id = 1; id <= MAX_RECORDS_PER_COURSE; id += 1) {
    await savePrivateReading("agentic-architect", "4", { pageId: String(id), title: "Synthetic", text: "Synthetic text." })
  }
  const full = await whileServing("agentic-architect", () => postPrivateReading(request({ ...body, template: "1832", pageId: "99999" })))
  assert.equal(full.status, 413)
  assert.deepEqual(await full.json(), { ok: false, reason: "limit" })
  const replace = await whileServing("agentic-architect", () => postPrivateReading(request({ ...body, template: "1832", pageId: "1", text: "Replacement synthetic text." })))
  assert.equal(replace.status, 200)
})

test("each refusal says what kind it was", async () => {
  const reasons = await whileServing("agentic-architect", async () => ({
    origin: await (await postPrivateReading(request(body, "http://other.example"))).json(),
    reading: await (await postPrivateReading(request({ ...body, text: "  " }))).json(),
    template: await (await postPrivateReading(request({ ...body, template: "9999" }))).json(),
    longId: await (await postPrivateReading(request({ ...body, pageId: "1".repeat(21) }))).json(),
    size: await (await postPrivateReading(request({ ...body, text: "\u0001".repeat(1_000_000) }))).json(),
    title: await (await postPrivateReading(request({ ...body, title: "t".repeat(501) }))).json(),
    untitled: await (await postPrivateReading(request({ ...body, title: "  " }))).json(),
  }))
  assert.deepEqual(reasons, {
    origin: { ok: false, reason: "origin" },
    reading: { ok: false, reason: "reading" },
    template: { ok: false, reason: "template" },
    longId: { ok: false, reason: "id" },
    size: { ok: false, reason: "size" },
    title: { ok: false, reason: "title" },
    untitled: { ok: false, reason: "untitled" },
  })
})

test("a request that came from the network is refused, and nothing is saved, whatever the client wrote first", async () => {
  const before = await readPrivateReadings("agentic-architect", "8")
  const refused = await whileServing("agentic-architect", async () => {
    const forwarded = await postPrivateReading(request({ ...body, pageId: "9100" }, "http://localhost", { "x-forwarded-for": "192.0.2.10" }))
    const real = await postPrivateReading(request({ ...body, pageId: "9101" }, "http://localhost", { "x-real-ip": "192.0.2.10" }))
    const standard = await postPrivateReading(request({ ...body, pageId: "9102" }, "http://localhost", { forwarded: "for=192.0.2.10" }))
    // A client that writes a loopback address first still shows up, because nginx appends the address it really came from.
    const forged = await postPrivateReading(request({ ...body, pageId: "9103" }, "http://localhost", { "x-forwarded-for": "127.0.0.1, 192.0.2.10" }))
    const withPort = await postPrivateReading(request({ ...body, pageId: "9104" }, "http://localhost", { "x-forwarded-for": "192.0.2.10:5555" }))
    return [forwarded, real, standard, forged, withPort]
  })
  for (const response of refused) {
    assert.equal(response.status, 400)
    assert.deepEqual(await response.json(), { ok: false, reason: "origin" })
  }
  assert.equal((await readPrivateReadings("agentic-architect", "8")).length, before.length, "nothing from the network was saved")
})

test("a request from this machine, which Next marks with loopback addresses, is still saved", async () => {
  for (const [index, header] of ([{ "x-forwarded-for": "::1" }, { "x-forwarded-for": "127.0.0.1" }, { "x-forwarded-for": "::ffff:127.0.0.1, 127.0.0.1" }, { forwarded: 'for="[::1]:4000"' }] as Record<string, string>[]).entries()) {
    const response = await whileServing("agentic-architect", () => postPrivateReading(request({ ...body, pageId: String(9200 + index) }, "http://localhost", header)))
    assert.equal(response.status, 200, JSON.stringify(header))
  }
})
