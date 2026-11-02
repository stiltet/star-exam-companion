import assert from "node:assert/strict"
import { execFile } from "node:child_process"
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs"
import { homedir, tmpdir } from "node:os"
import path from "node:path"
import test, { after } from "node:test"
import { BUILD_LOG, buildProblem, buildRecording, createNightBuild, encodeNightAudio, nightAudioResponse, nightDir, nightStatusResponse, scriptKey, writeJoinedWav } from "./night-build.ts"
import { joinWavs, nightParts, wavFromPcm, type NightBuildState, type NightPart } from "./night.ts"
import { renderSpeech } from "./say.ts"

const scratch = mkdtempSync(path.join(tmpdir(), "night-"))
after(() => {
  delete process.env.NIGHT_DIR
  rmSync(scratch, { recursive: true, force: true })
})

function tone(byte: number): Uint8Array {
  const pcm = new Uint8Array(4)
  pcm[0] = byte
  return wavFromPcm(pcm)
}

const parts: NightPart[] = [
  { courseId: "1", courseTitle: "Example", number: 1, title: "One", script: "One." },
  { courseId: "1", courseTitle: "Example", number: 2, title: "Two", script: "Two." },
]

async function settle(build: { begin: (retry: boolean) => NightBuildState }): Promise<NightBuildState> {
  let state = build.begin(false)
  for (let attempt = 0; attempt < 200 && (state.state === "building" || state.state === "checking"); attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 10))
    state = build.begin(false)
  }
  return state
}

test("a joined file matches the pure join, and a restart speaks only what is missing", async () => {
  const dir = path.join(scratch, "join")
  mkdirSync(dir)
  const first = path.join(dir, "a.wav")
  const second = path.join(dir, "b.wav")
  writeFileSync(first, tone(1))
  writeFileSync(second, tone(2))
  const dest = path.join(dir, "joined.wav")
  const durations = await writeJoinedWav([first, second], dest)
  const pure = joinWavs([tone(1), tone(2)])
  assert.deepEqual(durations, pure.durations)
  assert.deepEqual(readFileSync(dest), Buffer.from(pure.wav))

  const buildDir = path.join(scratch, "build")
  mkdirSync(path.join(buildDir, "b".repeat(64)), { recursive: true })
  const leftKey = scriptKey(parts)
  mkdirSync(path.join(buildDir, leftKey), { recursive: true })
  writeFileSync(path.join(buildDir, leftKey, "001.wav.123.partial"), "cut short")
  let calls = 0
  const failSecond = async (script: string, file: string) => {
    calls += 1
    if (script === "Two." && calls < 3) return false
    writeFileSync(file, tone(script === "One." ? 1 : 2))
    return true
  }
  const encode = async (_wav: string, m4a: string) => {
    writeFileSync(m4a, "audio")
  }
  await assert.rejects(() => buildRecording({ dir: buildDir, parts, render: failSecond, encode }), /could not speak reading 2 of course 1/)
  const ready = await buildRecording({ dir: buildDir, parts, render: failSecond, encode })
  assert.equal(calls, 3, "the finished reading is kept and only the failed one is spoken again")
  assert.equal(ready.chapters[1]?.title, "Two")
  assert.equal(statSync(buildDir).mode & 0o777, 0o700)
  assert.equal(exists(path.join(buildDir, "b".repeat(64))), false)
  assert.equal(exists(path.join(buildDir, leftKey, "001.wav.123.partial")), false, "a stopped say's leftover is cleared")
  const again = await buildRecording({ dir: buildDir, parts, render: failSecond, encode })
  assert.equal(calls, 3, "a finished recording is not spoken again")
  assert.equal(again.key, ready.key)

  const manifest = path.join(buildDir, ready.key, "manifest.json")
  assert.equal(JSON.parse(readFileSync(manifest, "utf8")).version, 1)
  writeFileSync(manifest, JSON.stringify({ hash: ready.key, duration: 1, chapters: [] }))
  await buildRecording({ dir: buildDir, parts, render: failSecond, encode })
  assert.equal(calls, 5, "a manifest from before versions is built again")
  writeFileSync(manifest, "{\"version\":1,")
  await buildRecording({ dir: buildDir, parts, render: failSecond, encode })
  assert.equal(calls, 7, "a damaged manifest is built again")
})

test("the recording lives in the user's caches folder, which a restart keeps", () => {
  const before = process.env.NIGHT_DIR
  delete process.env.NIGHT_DIR
  assert.equal(nightDir(), path.join(homedir(), "Library", "Caches", "star-exam-night"))
  process.env.NIGHT_DIR = "relative/path"
  assert.equal(nightDir(), path.join(homedir(), "Library", "Caches", "star-exam-night"))
  if (before === undefined) delete process.env.NIGHT_DIR
  else process.env.NIGHT_DIR = before
})

test("a joined file is refused when one reading is not a wav, and no read is left hanging", async () => {
  const dir = path.join(scratch, "bad-join")
  mkdirSync(dir)
  const good = path.join(dir, "a.wav")
  const bad = path.join(dir, "b.wav")
  writeFileSync(good, tone(1))
  writeFileSync(bad, "not a wav")
  await assert.rejects(() => writeJoinedWav([bad, good], path.join(dir, "joined.wav")), /not a wav/)
  await assert.rejects(() => writeJoinedWav([good, path.join(dir, "missing.wav"), good], path.join(dir, "joined.wav")), /ENOENT/)
})

test("a failed build can be tried again, and a stranger is refused before one starts", async () => {
  const dir = path.join(scratch, "retry")
  let fail = true
  const build = createNightBuild({
    dir,
    load: async () => {
      if (fail) throw new Error("Google answered 500 for contentObjects.json")
      return parts
    },
    render: async (_script, file) => {
      writeFileSync(file, tone(1))
      return true
    },
    encode: async (_wav, m4a) => {
      writeFileSync(m4a, "audio")
    },
  })
  const failed = await settle(build)
  assert.equal(failed.state, "failed")
  if (failed.state === "failed") assert.match(failed.error, /Google answered 500/)
  // The page sees "failed" first and the log line follows, so a loaded machine waits for it.
  const log = path.join(dir, BUILD_LOG)
  for (let attempt = 0; attempt < 200 && !(existsSync(log) && readFileSync(log, "utf8").endsWith("\n")); attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  assert.ok(existsSync(log), "the failure log line never appeared within 2 s")
  assert.match(readFileSync(log, "utf8"), /^\d{4}-\d{2}-\d{2}T[\d:.]+Z failed at 0 of 0: Google answered 500 for contentObjects\.json\n$/, "the Mac keeps a line for the failure")
  fail = false
  build.begin(true)
  let ready = build.begin(false)
  for (let attempt = 0; attempt < 200 && (ready.state === "building" || ready.state === "checking"); attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 10))
    ready = build.begin(false)
  }
  assert.equal(ready.state, "ready")
  const refused = nightStatusResponse(new Request("http://evil.example/api/night", { headers: { host: "evil.example" } }))
  assert.equal(refused.status, 400)
})

test("the recording answers a byte range and refuses a range past the end", async () => {
  const dir = path.join(scratch, "audio")
  const key = "c".repeat(64)
  mkdirSync(path.join(dir, key), { recursive: true })
  writeFileSync(path.join(dir, key, "night.m4a"), "abcdefghijklmnopqrstuvwxyz")
  writeFileSync(path.join(dir, key, "manifest.json"), "{}")
  process.env.NIGHT_DIR = dir
  const partial = await nightAudioResponse(new Request(`http://localhost/api/night/audio/${key}`, { headers: { host: "localhost", range: "bytes=0-3" } }), Promise.resolve({ key }))
  assert.equal(partial.status, 206)
  assert.equal(partial.headers.get("content-range"), "bytes 0-3/26")
  assert.equal(await partial.text(), "abcd")
  const past = await nightAudioResponse(new Request(`http://localhost/api/night/audio/${key}`, { headers: { host: "localhost", range: "bytes=40-50" } }), Promise.resolve({ key }))
  assert.equal(past.status, 416)
  const missing = await nightAudioResponse(new Request("http://localhost/api/night/audio/nope", { headers: { host: "localhost" } }), Promise.resolve({ key: "../secret" }))
  assert.equal(missing.status, 404)
})

test("a real recording's duration matches its chapter list", { timeout: 180_000, skip: process.platform !== "darwin" && "needs the Mac's say, afconvert and afinfo" }, async () => {
  const spoken = nightParts([
    { id: "1", title: "Example", readings: [{ number: 1, title: "One", paragraphs: [{ text: "Hello.", heading: false }] }, { number: 2, title: "Two", paragraphs: [{ text: "Good night.", heading: false }] }] },
  ])
  const ready = await buildRecording({
    dir: path.join(scratch, "real"),
    parts: spoken,
    render: (script, file) => renderSpeech(script, file, 60_000),
    encode: (wav, m4a) => encodeNightAudio(wav, m4a, 60_000),
  })
  assert.equal(ready.chapters[0]?.start, 0)
  assert.ok((ready.chapters[1]?.start ?? 0) > 0.5)
  const duration = await new Promise<number>((resolve, reject) => {
    execFile("afinfo", [path.join(scratch, "real", ready.key, "night.m4a")], { timeout: 30_000 }, (error, stdout) => {
      if (error) reject(error)
      const match = /estimated duration:\s+([\d.]+)/.exec(stdout)
      if (!match?.[1]) reject(new Error("afinfo gave no duration"))
      else resolve(Number(match[1]))
    })
  })
  assert.ok(Math.abs(duration - ready.duration) < 0.2, `encoded ${duration}s, chapters ${ready.duration}s`)
})

function exists(file: string): boolean {
  try {
    statSync(file)
    return true
  } catch {
    // The old hash directory is supposed to be gone.
    return false
  }
}

test("a recording already on the Mac is checked without being called a build", async () => {
  const dir = path.join(scratch, "checked")
  const deps = {
    dir,
    parts,
    render: async (_script: string, file: string) => {
      writeFileSync(file, tone(1))
      return true
    },
    encode: async (_wav: string, m4a: string) => {
      writeFileSync(m4a, "audio")
    },
  }
  const first: number[] = []
  await buildRecording({ ...deps, onProgress: (done) => first.push(done) })
  assert.equal(first[0], 0, "a real build says so before its first reading is spoken")
  const second: number[] = []
  await buildRecording({ ...deps, onProgress: (done) => second.push(done) })
  assert.deepEqual(second, [], "a recording that is already there is never reported as building")
  const build = createNightBuild({ dir, load: async () => parts, render: deps.render, encode: deps.encode })
  assert.deepEqual(build.begin(false), { state: "checking" })
  assert.equal((await settle(build)).state, "ready")
})

test("a system error reaches the page as a sentence without the Mac's paths", () => {
  const system = Object.assign(new Error("ENOENT: no such file or directory, open '/Users/someone/Library/Caches/star-exam-night/x'"), { code: "ENOENT" })
  assert.equal(buildProblem(system), "The Mac could not finish the recording. Try again.")
  assert.equal(buildProblem(new Error("The Mac could not encode the recording.")), "The Mac could not encode the recording.")
  assert.equal(buildProblem("odd"), "The Mac could not finish the recording. Try again.")
})

test("the phone fetches the recording past the browser's cache, since a rebuild keeps its address", () => {
  const source = readFileSync(new URL("../components/night-reader.tsx", import.meta.url), "utf8")
  assert.match(source, /fetch\(`\/api\/night\/audio\/\$\{ready\.key\}`, \{ cache: "no-store"/)
})
