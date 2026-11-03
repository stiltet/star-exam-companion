import assert from "node:assert/strict"
import { mkdtempSync, readFileSync, rmSync, existsSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import test, { after } from "node:test"
import { fileURLToPath } from "node:url"
import { postExam, switchExam } from "./exam-route.ts"

// The route reads the repo from the quiz directory, as the running app does, and saves to a scratch file.
const scratch = mkdtempSync(path.join(tmpdir(), "quiz-exam-route-"))
const before = { cwd: process.cwd(), setting: process.env.QUIZ_EXAM_SETTING_FILE }
const quiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const setting = path.join(scratch, "active-exam.json")
process.chdir(quiz)
process.env.QUIZ_EXAM_SETTING_FILE = setting
// A successful switch starts the new exam's Night recording; a test must not build one.
process.env.QUIZ_NIGHT_PRELOAD = "0"
after(() => {
  process.chdir(before.cwd)
  if (before.setting === undefined) delete process.env.QUIZ_EXAM_SETTING_FILE
  else process.env.QUIZ_EXAM_SETTING_FILE = before.setting
  rmSync(scratch, { recursive: true, force: true })
})

const post = (body: string, headers: Record<string, string> = {}, onSwitched: () => void = () => undefined) =>
  switchExam(new Request("http://localhost/api/exam", {
    method: "POST",
    headers: { host: "localhost", origin: "http://localhost", "content-type": "application/json", ...headers },
    body,
  }), onSwitched)

test("a same-origin JSON request naming a pack in exams/ switches the exam and saves the choice", async () => {
  const response = await post('{"exam":"agentic-architect"}')
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { ok: true, exam: "agentic-architect" })
  assert.equal(JSON.parse(readFileSync(setting, "utf8")).exam, "agentic-architect")
})

test("every other request is refused and changes nothing", async () => {
  rmSync(setting, { force: true })
  const refused: [string, Promise<Response>][] = [
    ["another site", post('{"exam":"agentic-architect"}', { origin: "http://evil.example" })],
    ["not JSON by content type", post('{"exam":"agentic-architect"}', { "content-type": "text/plain" })],
    ["an extra key", post('{"exam":"agentic-architect","x":1}')],
    ["a number for the exam", post('{"exam":7}')],
    ["an array body", post('["agentic-architect"]')],
    ["no exam", post("{}")],
    ["an unknown pack", post('{"exam":"no-such-exam"}')],
    ["a path out of exams/", post('{"exam":"../quiz"}')],
    ["a body that is not JSON", post("exam=agentic-architect")],
  ]
  for (const [name, response] of refused) assert.equal((await response).status, 400, name)
  assert.equal(existsSync(setting), false, "no refused request saved a choice")
})

test("a successful switch starts the new exam's Night recording, and a refused request does not", async () => {
  let started = 0
  await post('{"exam":"agentic-architect"}', {}, () => { started += 1 })
  assert.equal(started, 1)
  await post('{"exam":"no-such-exam"}', {}, () => { started += 1 })
  await post('{"exam":"agentic-architect"}', { origin: "http://evil.example" }, () => { started += 1 })
  assert.equal(started, 1, "a refused switch starts nothing")
})

test("the route handler takes the request alone, so Next's second argument cannot replace the switch hook", async () => {
  assert.equal(postExam.length, 1)
  const response = await postExam(new Request("http://localhost/api/exam", { method: "POST", headers: { host: "localhost", origin: "http://localhost", "content-type": "application/json" }, body: '{"exam":"no-such-exam"}' }))
  assert.equal(response.status, 400)
})
