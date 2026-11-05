import assert from "node:assert/strict"
import test from "node:test"
import { reading, type Bundle } from "./reading.ts"
import {
  byteRange, chapterAt, chapterList, clock, createNightWatch, joinWavs, keepWatching, manifestRecord, nightCacheUrl, nightParts, offlineLine,
  parseBuildState, parseManifest, parsePlace, pcmOf, placeRecord, readStore, replacedNightEntry, sayTimeoutMs, seekWhenReady, STATUS_GAP_MS,
  STATUS_GIVE_UP_MS, storedMegabytes, storeProblem, StoreRefused, wavFromPcm, WAV_RATE,
  type NightChapter, type NightPart, type NightRemote,
} from "./night.ts"

const key = "a".repeat(64)

test("Night recordings have a different cache key for each exam", () => {
  assert.equal(nightCacheUrl(key, "agentic-architect"), `/api/night/audio/${key}?exam=agentic-architect`)
  assert.notEqual(nightCacheUrl(key, "generative-ai-leader"), nightCacheUrl(key, "agentic-architect"))
})

function part(script: string, number = 1): NightPart {
  return { courseId: "1", courseTitle: "Example", number, title: "Intro", script }
}

test("courses and readings are spoken in order, with the markers and the pauses", () => {
  const parts = nightParts([
    {
      id: "1",
      title: "Example",
      readings: [
        { number: 1, title: "Empty", paragraphs: [] },
        {
          number: 2,
          title: "Intro",
          paragraphs: [
            { text: "Title", heading: true },
            { text: "See [[note]] here.", heading: false },
            { text: "Track KPIs today.", heading: false },
          ],
        },
        { number: 3, title: "Next", paragraphs: [{ text: "Second reading.", heading: false }] },
      ],
    },
    { id: "2", title: "Gen AI: Unlock Foundational Concepts", readings: [{ number: 1, title: "Start", paragraphs: [{ text: "Course two.", heading: false }] }] },
  ])
  assert.equal(parts.length, 3)
  assert.equal(parts[0]?.number, 2, "a reading with nothing to say is left out, and the number is the course list's")
  assert.match(parts[0]?.script ?? "", /^Course 1\. Example\. \[\[slnc 700\]\] Reading 2\. \[\[slnc 700\]\] Title\. \[\[slnc 700\]\] See note here\. \[\[slnc 350\]\] Track K-P-I's today\. \[\[slnc 2000\]\]$/)
  assert.doesNotMatch(parts[0]?.script ?? "", /\[\[note\]\]/)
  assert.ok((parts[0]?.script.match(/\[\[[^\]]*\]\]/g) ?? []).every((command) => /^\[\[slnc \d+\]\]$/.test(command)))
  assert.match(parts[1]?.script ?? "", /^Reading 3\. /)
  assert.match(parts[1]?.script ?? "", /\[\[slnc 4000\]\]$/)
  assert.match(parts[2]?.script ?? "", /^Course 2\. Gen AI: Unlock Foundational Concepts\. \[\[slnc 700\]\] Reading 1\. /)
})

test("a review is left out and the text after it, in the next article, is still read", () => {
  const bundle: Bundle = {
    contentObjects: [{ _id: "p", _type: "page", _sortOrder: 0, title: "C1_M1_L1 - Intro" }],
    articles: [
      { _id: "a1", _parentId: "p", _sortOrder: 0 },
      { _id: "a2", _parentId: "p", _sortOrder: 1 },
    ],
    blocks: [
      { _id: "b1", _parentId: "a1", _sortOrder: 0 },
      { _id: "b2", _parentId: "a2", _sortOrder: 0 },
    ],
    components: [
      { _id: "c1", _parentId: "b1", _sortOrder: 0, _component: "text", body: "<p>Teach this.</p>" },
      { _id: "c2", _parentId: "b1", _sortOrder: 1, _component: "mcq", _isQuestionType: true, displayTitle: "Quiz yourself", body: "<p>Secret answer.</p>" },
      { _id: "c3", _parentId: "b2", _sortOrder: 0, _component: "text", body: "<p>After the review.</p>" },
    ],
  }
  const page = reading(bundle, "p")
  const parts = nightParts([{ id: "1", title: "Example", readings: [{ number: 1, title: page?.title ?? "", paragraphs: page?.paragraphs ?? [] }] }])
  assert.match(parts[0]?.script ?? "", /Teach this/)
  assert.match(parts[0]?.script ?? "", /After the review/)
  assert.doesNotMatch(parts[0]?.script ?? "", /Secret answer/)
})

test("a short reading is given a minute and a long one scales, up to twenty minutes", () => {
  assert.equal(sayTimeoutMs("Hello."), 60_000)
  assert.equal(sayTimeoutMs(`${"word ".repeat(151 * 8)}`), 240_000)
  assert.equal(sayTimeoutMs(`${"word ".repeat(151 * 8 * 20)}`), 20 * 60_000)
})

test("chapter times follow the joined sound, and the chapter under the playhead is the current one", () => {
  const parts = [part("one", 1), part("two", 2)]
  const chapters = chapterList(parts, [1.5, 2])
  assert.deepEqual(chapters.map((chapter) => chapter.start), [0, 1.5])
  assert.equal(chapterAt(chapters, 1.49)?.number, 1)
  assert.equal(chapterAt(chapters, 1.5)?.number, 2)
  assert.equal(chapterAt(chapters, 99)?.number, 2)
  assert.equal(chapterAt([], 0), null)
  assert.throws(() => chapterList(parts, [1]), /each reading/)
})

test("joined wavs keep one header and each reading's length, filler chunk included", () => {
  const tone = new Uint8Array(WAV_RATE * 2)
  tone[0] = 1
  const plain = wavFromPcm(tone)
  const filler = wavWithFiller(tone)
  const { wav, durations } = joinWavs([plain, filler])
  assert.deepEqual(durations, [1, 1])
  const sound = pcmOf(wav)
  assert.equal(sound.length, tone.length * 2)
  assert.equal(sound[0], 1)
  assert.equal(sound[tone.length], 1)
  assert.equal(wav.length, 44 + sound.length)
})

test("a place, a build report and a byte range that cannot be read are refused", () => {
  const chapter: NightChapter = { courseId: "1", courseTitle: "Example", number: 1, title: "Intro", start: 0 }
  const place = parsePlace(placeRecord({ key, seconds: 12.5, bytes: 1000, chapters: [chapter] }))
  assert.equal(place?.seconds, 12.5)
  assert.equal(place?.chapters[0]?.title, "Intro")
  assert.equal(parsePlace("not json"), null)
  assert.equal(parsePlace(JSON.stringify({ key: "short", seconds: 1 })), null)
  assert.equal(parseBuildState({ state: "building", done: 2, total: 5 })?.state, "building")
  assert.equal(parseBuildState({ state: "ready", key: "nope" }), null)
  assert.equal(clock(3661), "1:01:01")
  assert.equal(clock(65), "1:05")
  assert.equal(storedMegabytes(58_000_000), "58 MB")
  assert.equal(storedMegabytes(1_500_000), "1.5 MB")
  assert.deepEqual(byteRange(null, 1000), { kind: "all" })
  assert.deepEqual(byteRange("bytes=0-99", 1000), { kind: "partial", start: 0, end: 99 })
  assert.deepEqual(byteRange("bytes=100-", 1000), { kind: "partial", start: 100, end: 999 })
  assert.deepEqual(byteRange("bytes=-100", 1000), { kind: "partial", start: 900, end: 999 })
  assert.equal(byteRange("bytes=1000-1001", 1000).kind, "unsatisfiable")
})

test("a build keeps being watched after a missed check, until half a minute without an answer", () => {
  assert.equal(keepWatching("building", false, null), true)
  assert.equal(keepWatching("building", false, 0), true)
  assert.equal(keepWatching("building", true, STATUS_GIVE_UP_MS - 1), true)
  assert.equal(keepWatching("building", false, STATUS_GIVE_UP_MS), false)
  assert.equal(keepWatching(null, false, 0), true)
  assert.equal(keepWatching(null, false, STATUS_GIVE_UP_MS), false)
  assert.equal(keepWatching(null, true, 0), false)
  assert.equal(keepWatching("ready", false, null), false)
  assert.equal(keepWatching("ready", false, 0), false)
})

test("a ready status of nought bytes is not a recording", () => {
  const ready = { state: "ready", key, duration: 1, chapters: [] }
  assert.equal(parseBuildState({ ...ready, bytes: 0 }), null)
  assert.equal(parseBuildState({ ...ready, bytes: 1.5 }), null)
  assert.equal(parseBuildState({ ...ready, bytes: 10 })?.state, "ready")
})

// A clock and a timer list the test moves by hand, so a page's watching can be followed step by step.
function fakeWatch(answers: (() => Promise<unknown>)[], stored = false) {
  let now = 0
  let next = 1
  const timers = new Map<number, () => void>()
  const shown: NightRemote[] = []
  const asked: boolean[] = []
  const watch = createNightWatch({
    status: (retry) => {
      asked.push(retry)
      const answer = answers.shift()
      return answer ? answer() : Promise.reject(new TypeError("Load failed"))
    },
    stored: () => stored,
    show: (remote) => shown.push(remote),
    later: (run, ms) => {
      assert.equal(ms, STATUS_GAP_MS)
      const handle = next++
      timers.set(handle, run)
      return handle
    },
    cancel: (handle) => timers.delete(handle),
    now: () => now,
  })
  // Runs the waiting check, after the gap, and lets its answer arrive.
  const tick = async () => {
    const [handle, run] = [...timers][0] ?? []
    if (handle === undefined || !run) return false
    timers.delete(handle)
    now += STATUS_GAP_MS
    run()
    await new Promise((resolve) => setImmediate(resolve))
    return true
  }
  return { watch, shown, asked, timers, tick, advance: (ms: number) => { now += ms } }
}

const building = (done: number) => () => Promise.resolve({ state: "building", done, total: 69 })
const noAnswer = () => Promise.reject(new DOMException("signal timed out", "TimeoutError"))

test("a build that stops answering is watched for half a minute, then the page keeps its last progress", async () => {
  const misses = Array.from({ length: 40 }, () => noAnswer)
  const page = fakeWatch([building(3), building(4), ...misses])
  await page.watch.look(false)
  await page.tick()
  assert.deepEqual(page.shown.at(-1), { state: "building", done: 4, total: 69 })
  let checks = 0
  while (checks < 100 && await page.tick()) checks += 1
  assert.ok(checks >= 14 && checks <= 16, `about half a minute of checks two seconds apart, got ${checks}`)
  assert.deepEqual(page.shown.at(-1), { state: "offline", done: 4, total: 69 })
  assert.equal(page.shown.filter((remote) => remote.state === "offline").length, 1, "the progress line stays until the misses run out")
  assert.equal(page.timers.size, 0, "it stops asking")
})

test("Try again starts the count again and shows the progress while it asks", async () => {
  const page = fakeWatch([building(4), ...Array.from({ length: 16 }, () => noAnswer), building(5)])
  await page.watch.look(false)
  for (let checks = 0; checks < 100 && await page.tick(); checks += 1);
  assert.equal(page.shown.at(-1)?.state, "offline")
  await page.watch.look(true)
  assert.deepEqual(page.asked.at(-1), true)
  assert.deepEqual(page.shown.at(-2), { state: "building", done: 4, total: 69 })
  assert.deepEqual(page.shown.at(-1), { state: "building", done: 5, total: 69 })
  assert.equal(page.timers.size, 1, "a build that answers again is watched again")
  page.watch.stop()
  assert.equal(page.timers.size, 0, "leaving the page stops the checks")
})

test("a first check with no answer and nothing stored keeps asking; with a recording stored it stops", async () => {
  const empty = fakeWatch([noAnswer, () => Promise.resolve({ state: "ready", key, bytes: 10, duration: 1, chapters: [] })])
  await empty.watch.look(false)
  assert.deepEqual(empty.shown.at(-1), { state: "offline", done: 0, total: 0 })
  await empty.tick()
  assert.equal(empty.shown.at(-1)?.state, "ready")
  assert.equal(empty.timers.size, 0)
  const away = fakeWatch([noAnswer], true)
  await away.watch.look(false)
  assert.equal(away.shown.at(-1)?.state, "offline")
  assert.equal(away.timers.size, 0)
  const garbled = fakeWatch([() => Promise.resolve({ state: "nonsense" })])
  await garbled.watch.look(false)
  assert.equal(garbled.shown.at(-1)?.state, "failed")
})

test("an answer to a check that Try again replaced is ignored", async () => {
  let release: (value: unknown) => void = () => undefined
  const slow = () => new Promise<unknown>((resolve) => { release = resolve })
  const page = fakeWatch([slow, building(9)])
  const first = page.watch.look(false)
  await page.watch.look(true)
  release({ state: "building", done: 1, total: 69 })
  await first
  assert.deepEqual(page.shown.at(-1), { state: "building", done: 9, total: 69 })
})

test("the offline line keeps the last progress and says what still plays", () => {
  assert.equal(offlineLine({ state: "offline", done: 4, total: 69 }, false), "The Mac is not answering. The recording had reached 4 of 69. This device has no recording yet.")
  assert.equal(offlineLine({ state: "offline", done: 0, total: 0 }, true), "The Mac cannot be reached. Play uses the recording on this device.")
})

function stream(chunks: number[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      for (const size of chunks) controller.enqueue(new Uint8Array(size))
      controller.close()
    },
  })
}

test("a store keeps exactly the named length, and stops the moment it runs past it", async () => {
  const seen: number[] = []
  const blob = await readStore(stream([4, 6]), 10, (got) => seen.push(got))
  assert.equal(blob.size, 10)
  assert.deepEqual(seen, [4, 10])
  let pulled = 0
  const endless = new ReadableStream<Uint8Array>({
    pull(controller) {
      pulled += 1
      controller.enqueue(new Uint8Array(4))
    },
  })
  await assert.rejects(() => readStore(endless, 10, () => undefined), (error: unknown) => error instanceof StoreRefused && /larger than the Mac described/.test(error.message))
  assert.ok(pulled <= 5, "the oversize body is not read to its end")
  await assert.rejects(() => readStore(stream([4]), 10, () => undefined), /stopped before it was complete/)
  await assert.rejects(() => readStore(stream([1]), 0, () => undefined), /larger than the Mac described/)
})

test("a store that fails says why in a sentence, not the browser's words", () => {
  assert.match(storeProblem(new DOMException("signal timed out", "TimeoutError")), /more than five minutes/)
  assert.match(storeProblem(new DOMException("aborted", "AbortError")), /more than five minutes/)
  assert.equal(storeProblem(new StoreRefused("The Mac answered 404, so nothing was stored. Try again.")), "The Mac answered 404, so nothing was stored. Try again.")
  assert.equal(storeProblem(new TypeError("Load failed")), "The Mac stopped sending the recording. Try again.")
  assert.equal(storeProblem(new DOMException("lost", "NetworkError")), "The Mac stopped sending the recording. Try again.")
  assert.equal(storeProblem(new DOMException("quota", "QuotaExceededError")), "This device could not keep the recording. Free some space and try again.")
})

test("a jump before the audio knows its length waits for it", () => {
  const listeners: (() => void)[] = []
  const media = {
    readyState: 0,
    currentTime: 0,
    addEventListener: (_type: "loadedmetadata", listener: () => void) => {
      listeners.push(listener)
    },
  }
  seekWhenReady(media, 30)
  assert.equal(media.currentTime, 0)
  media.readyState = 1
  listeners.forEach((listener) => listener())
  assert.equal(media.currentTime, 30)
  seekWhenReady(media, 60)
  assert.equal(media.currentTime, 60)
})

test("a manifest is read only at this version, for this script, and whole", () => {
  const chapter: NightChapter = { courseId: "1", courseTitle: "Example", number: 1, title: "Intro", start: 0 }
  const written = manifestRecord(key, { duration: 5, chapters: [chapter] })
  assert.deepEqual(parseManifest(written, key), { duration: 5, chapters: [chapter] })
  assert.equal(parseManifest(written, "b".repeat(64)), null)
  assert.equal(parseManifest(JSON.stringify({ hash: key, duration: 5, chapters: [chapter] }), key), null, "a manifest from before versions is built again")
  assert.equal(parseManifest(JSON.stringify({ version: 2, hash: key, duration: 5, chapters: [chapter] }), key), null)
  assert.equal(parseManifest(JSON.stringify({ version: 1, hash: key, duration: 5, chapters: [{ title: "x" }] }), key), null)
  assert.equal(parseManifest(written.slice(0, 20), key), null)
})

// A WAV with say's filler chunk, of an odd size so the pad byte is required.
function wavWithFiller(pcm: Uint8Array): Uint8Array {
  const clean = wavFromPcm(pcm)
  const before = clean.slice(0, 36)
  const data = clean.slice(36)
  const filler = new Uint8Array(8 + 1 + 1)
  filler.set(Uint8Array.from("FLLR", (char) => char.charCodeAt(0)))
  filler[4] = 1
  const out = new Uint8Array(before.length + filler.length + data.length)
  out.set(before, 0)
  out.set(filler, before.length)
  out.set(data, before.length + filler.length)
  const view = new DataView(out.buffer)
  view.setUint32(4, out.length - 8, true)
  return out
}

test("the Mac checking its recording is a state of its own, and it is watched", () => {
  assert.deepEqual(parseBuildState({ state: "checking" }), { state: "checking" })
  assert.equal(keepWatching("checking", true, null), true)
  assert.equal(keepWatching("checking", false, STATUS_GIVE_UP_MS), false)
})

test("a stored recording replaces the same exam's older audio, and an unnamed one only for the default exam", () => {
  const old = "b".repeat(64)
  const keep = nightCacheUrl(key, "generative-ai-leader")
  const unnamed = `/api/night/audio/${old}`
  assert.equal(replacedNightEntry(`https://x.test${unnamed}?exam=generative-ai-leader`, keep, "generative-ai-leader", "generative-ai-leader"), true)
  assert.equal(replacedNightEntry(`https://x.test${unnamed}`, keep, "generative-ai-leader", "generative-ai-leader"), true)
  assert.equal(replacedNightEntry(`https://x.test${unnamed}`, nightCacheUrl(key, "agentic-architect"), "agentic-architect", "generative-ai-leader"), false)
  assert.equal(replacedNightEntry(`https://x.test${unnamed}?exam=agentic-architect`, keep, "generative-ai-leader", "generative-ai-leader"), false)
  assert.equal(replacedNightEntry(`https://x.test${keep}`, keep, "generative-ai-leader", "generative-ai-leader"), false)
  assert.equal(replacedNightEntry("https://x.test/api/other", keep, "generative-ai-leader", "generative-ai-leader"), false)
})
