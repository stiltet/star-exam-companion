import assert from "node:assert/strict"
import test from "node:test"
import { chronological, isLearned, type ScoreLine } from "./learn.ts"
import { addToOutbox, mergeLines, newAnswer, newId, OUTBOX_KEY, REJECTED_KEY, readOutbox, readRejected, readRejectionReasons, sendOutbox, type SendResult, type Store } from "./outbox.ts"
import { acceptAnswer, MAX_BATCH, type Answer } from "./score.ts"

function memory(): Store & { data: Map<string, string> } {
  const data = new Map<string, string>()
  return { data, getItem: (key) => data.get(key) ?? null, setItem: (key, value) => void data.set(key, value) }
}

const at = (time: string) => `2026-10-01T${time}:00.000Z`
const answer = (n: number, time: string, extra: Partial<Answer> = {}): Answer => ({
  id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
  at: at(time),
  mode: "round",
  asked: ["a"],
  missed: [],
  ...extra,
})

test("ids are version 4 UUIDs the Mac accepts, and a new answer passes its checks", () => {
  assert.match(newId(), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  assert.equal(newId((bytes) => bytes.fill(255)), "ffffffff-ffff-4fff-bfff-ffffffffffff")
  assert.notEqual(newId(), newId())
  const fresh = newAnswer("practice", ["a"], ["a"], {}, new Date(at("10:00")))
  assert.deepEqual(acceptAnswer(fresh, { bankIds: new Set(["a"]), termNames: new Set() }, Date.parse(at("10:01"))), fresh)
})

test("an answer stays on the device until the Mac has stored it", async () => {
  const store = memory()
  addToOutbox(store, answer(1, "10:00"))
  addToOutbox(store, answer(2, "10:01"))
  const offline = await sendOutbox(store, async () => null)
  assert.deepEqual(offline, { sent: 0, waiting: 2, rejected: 0, reached: false, storageError: false })
  const online = await sendOutbox(store, async (batch) => ({ stored: batch.map((item) => item.id), duplicate: [], rejected: [] }))
  assert.deepEqual(online, { sent: 2, waiting: 0, rejected: 0, reached: true, storageError: false })
  assert.deepEqual(readOutbox(store), [])
})

test("a duplicate counts as sent, a refused answer is kept aside, and a late answer waits", async () => {
  const store = memory()
  addToOutbox(store, answer(1, "10:00"))
  addToOutbox(store, answer(2, "10:01"))
  const result = await sendOutbox(store, async (): Promise<SendResult> => {
    addToOutbox(store, answer(3, "10:02"))
    return { stored: [], duplicate: [answer(1, "10:00").id], rejected: [answer(2, "10:01").id] }
  })
  assert.deepEqual(result, { sent: 1, waiting: 1, rejected: 1, reached: true, storageError: false })
  assert.deepEqual(readOutbox(store).map((item) => item.id), [answer(3, "10:02").id])
  assert.deepEqual(readRejected(store).map((item) => item.id), [answer(2, "10:01").id])
})

test("a long outbox goes in batches of 500 and stops at the first the Mac does not answer", async () => {
  const store = memory()
  store.setItem(OUTBOX_KEY, JSON.stringify(Array.from({ length: MAX_BATCH * 2 + 1 }, (_, n) => answer(n, "10:00"))))
  const sizes: number[] = []
  const result = await sendOutbox(store, async (batch) => {
    sizes.push(batch.length)
    return sizes.length === 2 ? null : { stored: batch.map((item) => item.id), duplicate: [], rejected: [] }
  })
  assert.deepEqual(sizes, [MAX_BATCH, MAX_BATCH])
  assert.deepEqual(result, { sent: MAX_BATCH, waiting: MAX_BATCH + 1, rejected: 0, reached: false, storageError: false })
})

test("an answer about a removed question is dropped, not kept to retry, while a refused one is kept", async () => {
  const store = memory()
  const removed = answer(1, "10:00", { mode: "practice", asked: ["q75"] })
  const bad = answer(2, "10:01")
  const fine = answer(3, "10:02")
  store.setItem(OUTBOX_KEY, JSON.stringify([removed, bad, fine]))
  const result = await sendOutbox(store, async (batch) => ({
    stored: [fine.id], duplicate: [], rejected: [removed.id, bad.id], gone: [removed.id], reasons: { [removed.id]: "gone", [bad.id]: "invalid" },
  }))
  assert.deepEqual(result, { sent: 1, waiting: 0, rejected: 1, reached: true, storageError: false })
  assert.deepEqual(readRejected(store).map((item) => item.id), [bad.id])
  assert.deepEqual(readRejectionReasons(store), { [bad.id]: "invalid" })
  // A refused answer retried later is dropped too once the Mac says its question is gone.
  const retry = await sendOutbox(store, async (batch) => ({ stored: [], duplicate: [], rejected: batch.map((item) => item.id), gone: batch.map((item) => item.id) }), true)
  assert.deepEqual(retry, { sent: 0, waiting: 0, rejected: 0, reached: true, storageError: false })
})

test("14 legacy refused answers recover unchanged, count in the snapshot and never duplicate", async () => {
  const store = memory()
  const original = Array.from({ length: 14 }, (_, n) => answer(n + 1, "10:00", {
    mode: n === 13 ? "exam" : "practice", asked: [`q${n + 1}`], missed: n % 2 ? [`q${n + 1}`] : [],
    ...(n === 13 ? { seconds: 420 } : {}),
  }))
  store.setItem(REJECTED_KEY, JSON.stringify(original))
  let saved: ScoreLine[] = []
  const post = async (batch: Answer[]): Promise<SendResult> => {
    assert.deepEqual(batch, original)
    const { storeAnswers } = await import("./score.ts")
    const result = storeAnswers(saved, batch)
    saved = [...saved, ...result.lines]
    return { stored: result.stored, duplicate: result.duplicate, rejected: [] }
  }
  await sendOutbox(store, async () => { assert.fail("automatic sends must not retry refused records") })
  const result = await sendOutbox(store, post, true)
  assert.deepEqual(result, { sent: 14, waiting: 0, rejected: 0, reached: true, storageError: false })
  assert.deepEqual(readRejected(store), [])
  assert.deepEqual(saved.map(({ id, at, mode, asked, missed, seconds }) => ({
    id, at, mode, asked, missed, ...(seconds === undefined ? {} : { seconds }),
  })), original)
  assert.equal(mergeLines(saved, original).length, 14)
  await sendOutbox(store, async () => { assert.fail("acknowledged records must not be sent again") }, true)
  // A stale second device copy is acknowledged as duplicate, not appended again.
  store.setItem(REJECTED_KEY, JSON.stringify(original))
  await sendOutbox(store, post, true)
  assert.equal(saved.length, 14)
})

test("retry keeps invalid answers with reasons and preserves newly queued answers", async () => {
  const store = memory()
  const records = [answer(1, "10:00"), answer(2, "10:01"), answer(3, "10:02")]
  store.setItem(REJECTED_KEY, JSON.stringify(records))
  const result = await sendOutbox(store, async () => {
    addToOutbox(store, answer(4, "10:03"))
    return { stored: [records[0]!.id], duplicate: [records[1]!.id], rejected: [records[2]!.id], reasons: { [records[2]!.id]: "Unknown question." } }
  }, true)
  assert.deepEqual(result, { sent: 2, waiting: 1, rejected: 1, reached: true, storageError: false })
  assert.deepEqual(readRejected(store), [records[2]])
  assert.deepEqual(readOutbox(store), [answer(4, "10:03")])
  assert.deepEqual(readRejectionReasons(store), { [records[2]!.id]: "Unknown question." })
  await sendOutbox(store, async () => null, true)
  assert.deepEqual(readRejected(store), [records[2]])
})

test("failed local writes never lose a refused answer", async () => {
  for (const blocked of [REJECTED_KEY, OUTBOX_KEY]) {
    const backing = memory()
    addToOutbox(backing, answer(1, "10:00"))
    const store: Store = {
      getItem: backing.getItem,
      setItem: (key, value) => {
        if (key === blocked) throw new Error("Storage full")
        backing.setItem(key, value)
      },
    }
    const result = await sendOutbox(store, async () => ({ stored: [], duplicate: [], rejected: [answer(1, "10:00").id] }))
    assert.equal(result.storageError, true)
    assert.ok([...readOutbox(backing), ...readRejected(backing)].some((item) => item.id === answer(1, "10:00").id))
  }
})

test("old-server refusals remain visible and unsolicited acknowledgements cannot delete other answers", async () => {
  const store = memory()
  addToOutbox(store, answer(1, "10:00"))
  await sendOutbox(store, async () => {
    addToOutbox(store, answer(2, "10:01"))
    return { stored: [answer(2, "10:01").id], duplicate: [], rejected: [answer(1, "10:00").id] }
  })
  assert.deepEqual(readOutbox(store), [answer(2, "10:01")])
  assert.match(readRejectionReasons(store)[answer(1, "10:00").id]!, /did not provide a reason/)
})

test("unreadable or blocked storage never throws", () => {
  const broken = memory()
  broken.setItem(OUTBOX_KEY, "{not json")
  assert.deepEqual(readOutbox(broken), [])
  const full: Store = { getItem: () => null, setItem: () => { throw new Error("QuotaExceededError") } }
  assert.equal(addToOutbox(full, answer(1, "10:00")), false)
})

test("the device merges the Mac's lines with its own, in answer order, each once", () => {
  const saved: ScoreLine[] = [
    { date: "2026-09-30", session: 2, mode: "round", asked: ["x"], missed: [] },
    { date: "2026-10-01", session: 3, mode: "round", asked: ["a"], missed: ["a"], id: answer(1, "09:00").id, at: at("09:00") },
  ]
  const merged = mergeLines(saved, [answer(1, "09:00"), answer(2, "08:50", { asked: ["b"] }), answer(3, "11:00")])
  assert.deepEqual(merged.map((line) => line.asked[0]), ["x", "b", "a", "a"])
  assert.deepEqual(merged.map((line) => line.session), [2, 3, 3, 4])
})

test("a fixed miss is learned even when its lines reach the Mac out of order", () => {
  // The phone's morning miss arrives after the Mac's afternoon answers, with a higher session number.
  const lines: ScoreLine[] = [
    { date: "2026-10-01", session: 5, mode: "round", asked: ["a"], missed: [], at: at("13:00") },
    { date: "2026-10-01", session: 5, mode: "round", asked: ["a"], missed: [], at: at("14:00") },
    { date: "2026-10-01", session: 5, mode: "round", asked: ["a"], missed: [], at: at("15:00") },
    { date: "2026-10-01", session: 6, mode: "round", asked: ["a"], missed: ["a"], at: at("08:00") },
  ]
  assert.equal(isLearned("a", lines), false, "file order: the miss looks last")
  assert.equal(isLearned("a", chronological(lines)), true)
})

test("an exam's answers and flags ride along in its saved answer", () => {
  const exam = newAnswer("exam", ["a", "b"], ["b"], { seconds: 60, answers: { a: 0 }, flagged: ["b"] })
  assert.deepEqual([exam.seconds, exam.answers, exam.flagged], [60, { a: 0 }, ["b"]])
  assert.equal("answers" in newAnswer("practice", ["a"], []), false)
})
