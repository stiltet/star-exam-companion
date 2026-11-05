import assert from "node:assert/strict"
import test from "node:test"
import { EXAM_HEADER, examHeaders, followWrongExam } from "./exam-header.ts"

test("exam-header: a request names the page's exam", () => {
  // Outside a browser a page has no exam of its own, so it is the default exam's.
  assert.deepEqual(examHeaders(), { [EXAM_HEADER]: "generative-ai-leader" })
})

test("exam-header: only a 409 that names the exam served is a wrong-exam refusal", async () => {
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })
  assert.equal(await followWrongExam(json(409, { ok: false, wrongExam: "agentic-architect" })), true)
  assert.equal(await followWrongExam(json(409, { ok: false, row: "Broken", error: "bad row" })), false, "a glossary 409 is the caller's")
  assert.equal(await followWrongExam(json(200, { ok: true })), false)
  assert.equal(await followWrongExam(new Response("not json", { status: 409 })), false)
})

// A page for followWrongExam: a session store, a counter for reloads and the exam on <html>.
function withPage(exam: string, run: (reloads: () => number) => Promise<void>, reported: Error[] = []): Promise<void> {
  const store = new Map<string, string>()
  let reloaded = 0
  const globals = globalThis as unknown as Record<string, unknown>
  const before = { window: globals.window, document: globals.document }
  globals.document = { documentElement: { dataset: { exam } } }
  globals.window = {
    sessionStorage: { getItem: (key: string) => store.get(key) ?? null, setItem: (key: string, value: string) => void store.set(key, value) },
    location: { reload: () => void (reloaded += 1) },
    reportError: (error: Error) => reported.push(error),
    setTimeout,
    clearTimeout,
  }
  return run(() => reloaded).finally(() => {
    globals.window = before.window
    globals.document = before.document
  })
}

const wrong = (served: string) => new Response(JSON.stringify({ ok: false, wrongExam: served }), { status: 409, headers: { "Content-Type": "application/json" } })

test("exam-header: a page of another exam reloads once, and never twice in a row", async () => {
  await withPage("generative-ai-leader", async (reloads) => {
    assert.equal(await followWrongExam(wrong("agentic-architect")), true)
    assert.equal(reloads(), 1)
    assert.equal(await followWrongExam(wrong("agentic-architect")), true)
    assert.equal(reloads(), 1, "a second refusal within the gap does not reload again")
  })
})

test("exam-header: a refusal naming the page's own exam does not reload", async () => {
  await withPage("agentic-architect", async (reloads) => {
    assert.equal(await followWrongExam(wrong("agentic-architect")), true)
    assert.equal(reloads(), 0)
  })
})

test("exam-header: a wrong-exam reload waits for the offline worker to resume page fetching", async () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "navigator")
  let posted: () => void = () => {}
  const received = new Promise<void>((resolve) => { posted = resolve })
  const ports: MessagePort[] = []
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { serviceWorker: { controller: { postMessage: (message: string, transfer: MessagePort[]) => {
      assert.equal(message, "quiz-mac-reachable")
      ports.push(...transfer)
      posted()
    } } } },
  })
  try {
    await withPage("generative-ai-leader", async (reloads) => {
      const result = followWrongExam(wrong("agentic-architect"))
      await received
      assert.equal(reloads(), 0)
      assert.equal(ports.length, 1)
      ports[0]?.postMessage("ready")
      assert.equal(await result, true)
      assert.equal(reloads(), 1)
      ports[0]?.close()
    })
  } finally {
    if (previous) Object.defineProperty(globalThis, "navigator", previous)
    else Reflect.deleteProperty(globalThis, "navigator")
  }
})

test("exam-header: a worker message failure is reported and does not strand a reload", async () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "navigator")
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { serviceWorker: { controller: { postMessage: () => { throw new Error("worker unavailable") } } } },
  })
  const reported: Error[] = []
  try {
    await withPage("generative-ai-leader", async (reloads) => {
      assert.equal(await followWrongExam(wrong("agentic-architect")), true)
      assert.equal(reloads(), 1)
      assert.equal(reported.length, 1)
      assert.match(reported[0]?.message ?? "", /Could not tell the offline worker/)
      assert.match(String(reported[0]?.cause), /worker unavailable/)
    }, reported)
  } finally {
    if (previous) Object.defineProperty(globalThis, "navigator", previous)
    else Reflect.deleteProperty(globalThis, "navigator")
  }
})

test("exam-header: an unresponsive worker is reported and does not strand a reload", async () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "navigator")
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { serviceWorker: { controller: { postMessage: (_message: string, ports: MessagePort[]) => ports[0]?.close() } } },
  })
  const reported: Error[] = []
  try {
    await withPage("generative-ai-leader", async (reloads) => {
      assert.equal(await followWrongExam(wrong("agentic-architect")), true)
      assert.equal(reloads(), 1)
      assert.equal(reported.length, 1)
      assert.match(reported[0]?.message ?? "", /did not confirm/)
    }, reported)
  } finally {
    if (previous) Object.defineProperty(globalThis, "navigator", previous)
    else Reflect.deleteProperty(globalThis, "navigator")
  }
})
