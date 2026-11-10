import assert from "node:assert/strict"
import test, { after } from "node:test"
import { CLIP_TIMEOUT_MS, fetchClip, macGate } from "./clip.ts"

// AbortSignal.timeout does not keep Node running by itself, so a timer keeps the test process alive while it waits.
const keepAlive = setInterval(() => undefined, 50)
after(() => clearInterval(keepAlive))

// A Mac that never answers: the request ends only when the timer's signal aborts it.
const silentMac: typeof fetch = (_url, init) =>
  new Promise((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => reject(init.signal?.reason))
  })

test("the Mac has ten seconds per sentence", () => {
  assert.equal(CLIP_TIMEOUT_MS, 10_000)
})

// An explicit limit, so a clip helper that lost its timer fails with a name instead of hanging the run.
test("a Mac that does not answer in time is a plain sentence, not a hang or a raw browser error", { timeout: 5000 }, async () => {
  const started = Date.now()
  await assert.rejects(() => fetchClip("Synthetic sentence.", 40, silentMac), /^Error: the Mac did not answer in time$/)
  assert.ok(Date.now() - started < 2000, "it gave up when the timer ran out")
})

test("a clip that never finishes is cut off by the timer, so deleting the timer fails this test", { timeout: 5000 }, async () => {
  let signalSeen: AbortSignal | undefined
  const watching: typeof fetch = (url, init) => {
    signalSeen = init?.signal ?? undefined
    return silentMac(url, init)
  }
  await assert.rejects(() => fetchClip("Synthetic sentence.", 30, watching))
  assert.ok(signalSeen, "the request carries the timer's signal")
  assert.equal(signalSeen?.aborted, true)
})

// The headers arrive and then the audio stalls: the timer must still cut it off and give the same plain sentence.
test("a Mac that sends its headers and then stalls on the audio is a plain timeout too", { timeout: 5000 }, async () => {
  const stalling: typeof fetch = (_url, init) => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        init?.signal?.addEventListener("abort", () => controller.error(init.signal?.reason))
      },
    })
    return Promise.resolve(new Response(body, { status: 200 }))
  }
  await assert.rejects(() => fetchClip("Synthetic sentence.", 40, stalling), /^Error: the Mac did not answer in time$/)
})

test("an error from the Mac says what it answered, and a good answer returns the clip", async () => {
  await assert.rejects(() => fetchClip("x", 1000, async () => new Response("{}", { status: 500 })), /^Error: the Mac answered 500$/)
  const blob = await fetchClip("x", 1000, async () => new Response("audio", { status: 200 }))
  assert.equal(await blob.text(), "audio")
})

test("a network failure keeps its own message", async () => {
  await assert.rejects(() => fetchClip("x", 1000, async () => { throw new TypeError("Failed to fetch") }), /Failed to fetch/)
})

test("after one failure the next sentences skip the Mac until the next Play", () => {
  const gate = macGate()
  assert.equal(gate.skipped(), null, "a fresh gate tries the Mac")
  gate.failed(new Error("the Mac did not answer in time"))
  assert.equal(gate.skipped()?.message, "the Mac did not answer in time")
  assert.equal(gate.skipped()?.message, "the Mac did not answer in time", "and keeps skipping, with no new wait per sentence")
  gate.reset()
  assert.equal(gate.skipped(), null, "a new Play tries the Mac again")
})

test("a failure of a request made ahead of time counts only while its reading is still current", () => {
  const gate = macGate()
  gate.failedIf(false, new Error("old reading"))
  assert.equal(gate.skipped(), null, "a request for a reading that has since changed is ignored")
  gate.failedIf(true, new Error("the Mac did not answer in time"))
  assert.equal(gate.skipped()?.message, "the Mac did not answer in time", "a look-ahead that times out sends the next sentence straight to the device voice")
})
