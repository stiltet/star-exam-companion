import assert from "node:assert/strict"
import { chmodSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import test, { after } from "node:test"
import { speakHandler } from "./speak-route.ts"

const quiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const scratch = mkdtempSync(path.join(tmpdir(), "speak-route-"))
after(() => rmSync(scratch, { recursive: true, force: true }))

// A fake `say` first on PATH: writes stdin to the -o file.
const bin = path.join(scratch, "bin")
mkdirSync(bin)
writeFileSync(path.join(bin, "say"), `#!/bin/bash
out=""
while [ $# -gt 0 ]; do [ "$1" = "-o" ] && out="$2"; shift; done
printf 'RIFF%s' "$(cat)" > "$out"
`)
chmodSync(path.join(bin, "say"), 0o755)
process.env.PATH = `${bin}:${process.env.PATH}`

function post(body: unknown, origin = "http://localhost"): Request {
  return new Request("http://localhost/api/speak/reading", {
    method: "POST",
    headers: { host: "localhost", origin, "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

test("a same-origin { text } is spoken into the handler's own pool", async () => {
  const dir = path.join(scratch, "pool")
  const response = await speakHandler({ dir, keep: 5 })(post({ text: "Data types." }))
  assert.equal(response.status, 200)
  assert.equal(response.headers.get("content-type"), "audio/wav")
  assert.equal(Buffer.from(await response.arrayBuffer()).toString(), "RIFFData types.")
  assert.equal(readdirSync(dir).filter((name) => name.endsWith(".wav")).length, 1)
})

test("another origin or a body that is not { text } is refused before anything is spoken", async () => {
  const dir = path.join(scratch, "refused")
  assert.equal((await speakHandler({ dir, keep: 5 })(post({ text: "Hi." }, "http://evil.example"))).status, 400)
  assert.equal((await speakHandler({ dir, keep: 5 })(post({ text: "Hi.", voice: "x" }))).status, 400)
})

// A deliberate pin on the source: Next routes cannot be imported here, and swapping the two pools
// back must fail a test. A reformat of these lines may need the patterns updated, not removed.
test("Read Aloud speaks into its own pool and the Voice Quiz into its own", () => {
  const route = (relative: string) => readFileSync(path.join(quiz, relative), "utf8")
  assert.match(route("app/api/speak/reading/route.ts"), /speakHandler\(READING_POOL\)/)
  assert.match(route("app/api/speak/route.ts"), /speakHandler\(VOICE_POOL\)/)
  // Read Aloud asks for its clips through the clip helper, which is what names the reading pool's route.
  assert.match(route("lib/clip.ts"), /fetcher\("\/api\/speak\/reading"/)
  assert.match(route("components/read-aloud.tsx"), /fetchClip\(text\)/)
})
