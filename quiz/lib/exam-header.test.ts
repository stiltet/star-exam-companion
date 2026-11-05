import assert from "node:assert/strict"
import test from "node:test"
import { EXAM_HEADER, EXAM_REFRESH_FAILED, examHeaders, followWrongExam } from "./exam-header.ts"

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
function withPage(exam: string, run: (reloads: () => number) => Promise<void>, events: string[] = []): Promise<void> {
  const store = new Map<string, string>()
  let reloaded = 0
  const globals = globalThis as unknown as Record<string, unknown>
  const before = { window: globals.window, document: globals.document }
  globals.document = { documentElement: { dataset: { exam } } }
  globals.window = {
    sessionStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
      removeItem: (key: string) => void store.delete(key),
    },
    location: { reload: () => void (reloaded += 1) },
    dispatchEvent: (event: Event) => void events.push(event.type),
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

test("exam-header: a worker message failure does not reload stale HTML and can be retried", async () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "navigator")
  let fails = true
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { serviceWorker: {
      controller: { postMessage: (_message: string, ports: MessagePort[]) => {
        if (fails) throw new Error("worker unavailable")
        ports[0]?.postMessage("ready")
        ports[0]?.close()
      } },
      getRegistration: async () => undefined,
      addEventListener: () => {},
      removeEventListener: () => {},
    } },
  })
  const events: string[] = []
  try {
    await withPage("generative-ai-leader", async (reloads) => {
      assert.equal(await followWrongExam(wrong("agentic-architect")), true)
      assert.equal(reloads(), 0)
      assert.deepEqual(events, [EXAM_REFRESH_FAILED])
      fails = false
      assert.equal(await followWrongExam(wrong("agentic-architect")), true)
      assert.equal(reloads(), 1)
    }, events)
  } finally {
    if (previous) Object.defineProperty(globalThis, "navigator", previous)
    else Reflect.deleteProperty(globalThis, "navigator")
  }
})

test("exam-header: a failed message channel keeps the page in place and shows a warning", async () => {
  const previousNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator")
  const previousChannel = Object.getOwnPropertyDescriptor(globalThis, "MessageChannel")
  Object.defineProperty(globalThis, "MessageChannel", {
    configurable: true,
    value: class { constructor() { throw new Error("message channel unavailable") } },
  })
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { serviceWorker: {
      controller: {},
      getRegistration: async () => undefined,
      addEventListener: () => {},
      removeEventListener: () => {},
    } },
  })
  const events: string[] = []
  try {
    await withPage("generative-ai-leader", async (reloads) => {
      assert.equal(await followWrongExam(wrong("agentic-architect")), true)
      assert.equal(reloads(), 0)
      assert.deepEqual(events, [EXAM_REFRESH_FAILED])
    }, events)
  } finally {
    if (previousNavigator) Object.defineProperty(globalThis, "navigator", previousNavigator)
    else Reflect.deleteProperty(globalThis, "navigator")
    if (previousChannel) Object.defineProperty(globalThis, "MessageChannel", previousChannel)
    else Reflect.deleteProperty(globalThis, "MessageChannel")
  }
})

for (const [failure, getRegistration] of [
  ["throws", () => { throw new Error("registration unavailable") }],
  ["rejects", async () => { throw new Error("registration unavailable") }],
  ["cannot update", async () => ({ update: async () => { throw new Error("update unavailable") } })],
] as const) {
  test(`exam-header: a worker registration that ${failure} shows a warning`, async () => {
    const previous = Object.getOwnPropertyDescriptor(globalThis, "navigator")
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: { serviceWorker: {
        controller: { postMessage: () => { throw new Error("old worker unavailable") } },
        getRegistration,
        addEventListener: () => {},
        removeEventListener: () => {},
      } },
    })
    const events: string[] = []
    try {
      await withPage("generative-ai-leader", async (reloads) => {
        assert.equal(await followWrongExam(wrong("agentic-architect")), true)
        assert.equal(reloads(), 0)
        assert.deepEqual(events, [EXAM_REFRESH_FAILED])
      }, events)
    } finally {
      if (previous) Object.defineProperty(globalThis, "navigator", previous)
      else Reflect.deleteProperty(globalThis, "navigator")
    }
  })
}

test("exam-header: blocked session storage keeps the page in place and shows a warning", async () => {
  const events: string[] = []
  await withPage("generative-ai-leader", async (reloads) => {
    window.sessionStorage.getItem = () => { throw new Error("storage unavailable") }
    assert.equal(await followWrongExam(wrong("agentic-architect")), true)
    assert.equal(reloads(), 0)
    assert.deepEqual(events, [EXAM_REFRESH_FAILED])
  }, events)
})

test("exam-header: an unresponsive worker leaves the page in place and shows a warning", async () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "navigator")
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { serviceWorker: {
      controller: { postMessage: (_message: string, ports: MessagePort[]) => ports[0]?.close() },
      getRegistration: async () => undefined,
      addEventListener: () => {},
      removeEventListener: () => {},
    } },
  })
  const events: string[] = []
  try {
    await withPage("generative-ai-leader", async (reloads) => {
      assert.equal(await followWrongExam(wrong("agentic-architect")), true)
      assert.equal(reloads(), 0)
      assert.deepEqual(events, [EXAM_REFRESH_FAILED])
    }, events)
  } finally {
    if (previous) Object.defineProperty(globalThis, "navigator", previous)
    else Reflect.deleteProperty(globalThis, "navigator")
  }
})

test("exam-header: an older worker is updated before the wrong-exam page reloads", async () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "navigator")
  const listeners = new Set<() => void>()
  const older = { postMessage: (_message: string, _ports: MessagePort[]): void => { throw new Error("old worker") } }
  const newer = { postMessage: (_message: string, ports: MessagePort[]) => {
    ports[0]?.postMessage("ready")
    ports[0]?.close()
  } }
  let controller = older
  const registration = {
    active: older,
    installing: null,
    waiting: null,
    update: async () => {
      controller = newer
      for (const listener of listeners) listener()
    },
  }
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { serviceWorker: {
      get controller() { return controller },
      getRegistration: async () => registration,
      addEventListener: (_type: string, listener: () => void) => void listeners.add(listener),
      removeEventListener: (_type: string, listener: () => void) => void listeners.delete(listener),
    } },
  })
  try {
    await withPage("generative-ai-leader", async (reloads) => {
      assert.equal(await followWrongExam(wrong("agentic-architect")), true)
      assert.equal(reloads(), 1)
      assert.equal(controller, newer)
      assert.equal(listeners.size, 0)
    })
  } finally {
    if (previous) Object.defineProperty(globalThis, "navigator", previous)
    else Reflect.deleteProperty(globalThis, "navigator")
  }
})

test("exam-header: a replacement controller is acknowledged even if the older worker replied", async () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "navigator")
  let acknowledgements = 0
  const newer = { postMessage: (_message: string, ports: MessagePort[]) => {
    acknowledgements += 1
    ports[0]?.postMessage("ready")
    ports[0]?.close()
  } }
  const older = { postMessage: (_message: string, ports: MessagePort[]) => {
    controller = newer
    ports[0]?.postMessage("ready")
    ports[0]?.close()
  } }
  let controller = older
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { serviceWorker: { get controller() { return controller } } },
  })
  try {
    await withPage("generative-ai-leader", async (reloads) => {
      assert.equal(await followWrongExam(wrong("agentic-architect")), true)
      assert.equal(acknowledgements, 1)
      assert.equal(reloads(), 1)
    })
  } finally {
    if (previous) Object.defineProperty(globalThis, "navigator", previous)
    else Reflect.deleteProperty(globalThis, "navigator")
  }
})
