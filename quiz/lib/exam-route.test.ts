import assert from "node:assert/strict"
import { mkdtempSync, readFileSync, rmSync, existsSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import test, { after } from "node:test"
import { fileURLToPath } from "node:url"
import { postExam } from "./exam-route.ts"

// The route reads the repo from the quiz directory, as the running app does, and saves to a scratch file.
const scratch = mkdtempSync(path.join(tmpdir(), "quiz-exam-route-"))
const before = { cwd: process.cwd(), setting: process.env.QUIZ_EXAM_SETTING_FILE }
const quiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const setting = path.join(scratch, "active-exam.json")
process.chdir(quiz)
process.env.QUIZ_EXAM_SETTING_FILE = setting
after(() => {
  process.chdir(before.cwd)
  if (before.setting === undefined) delete process.env.QUIZ_EXAM_SETTING_FILE
  else process.env.QUIZ_EXAM_SETTING_FILE = before.setting
  rmSync(scratch, { recursive: true, force: true })
})

const post = (body: string, headers: Record<string, string> = {}) =>
  postExam(new Request("http://localhost/api/exam", {
    method: "POST",
    headers: { host: "localhost", origin: "http://localhost", "content-type": "application/json", ...headers },
    body,
  }))

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
