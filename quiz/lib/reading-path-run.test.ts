import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { mkdtemp, rm } from "node:fs/promises"
import { createServer } from "node:net"
import { tmpdir } from "node:os"
import path from "node:path"
import test from "node:test"
import { startFakeSite, type FakeSite } from "./fake-lesson-site.ts"
import { BUNDLE_BASE } from "./reading-path.ts"
import { testRoot } from "./test-pack.ts"

// These tests run the real command, `node scripts/reading-path.mts`, against a fake learning-path page with made-up courses, with a
// scratch browser profile. No real Google page is involved.

const quiz = path.join(testRoot, "quiz")

async function freePort(): Promise<number> {
  const probe = createServer()
  await new Promise<void>((resolve) => probe.listen(0, "127.0.0.1", resolve))
  const port = (probe.address() as { port: number }).port
  await new Promise<void>((resolve) => probe.close(() => resolve()))
  return port
}

type Run = { code: number | null; out: string; err: string; port: number }

async function runPath(profile: string, site: FakeSite, args: string[]): Promise<Run> {
  const port = await freePort()
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    NO_COLOR: "1",
    READING_SITE: site.url,
    READING_CDP_URL: `http://127.0.0.1:${port}`,
    READING_PROFILE_DIR: profile,
    READING_SKIP_SIGNIN: "1",
    READING_PATH_WAIT_MS: "2000",
  }
  // A shell that is set up for the real capture must not change a test.
  delete env.READING_GOOGLE_ACCOUNT
  delete env.READING_DEBUG
  const child = spawn(process.execPath, ["scripts/reading-path.mts", ...args], { cwd: quiz, env })
  let out = ""
  let err = ""
  child.stdout.on("data", (chunk) => { out += String(chunk) })
  child.stderr.on("data", (chunk) => { err += String(chunk) })
  const code = await new Promise<number | null>((resolve) => child.on("close", resolve))
  return { code, out, err, port }
}

async function browserClosed(port: number): Promise<boolean> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    try {
      await fetch(`http://127.0.0.1:${port}/json/version`, { signal: AbortSignal.timeout(1_000) })
    } catch {
      return true
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  return false
}

test("the path command lists a learning path's courses in Google's order, as text or as the courses file", { timeout: 180_000 }, async (t) => {
  const base = await mkdtemp(path.join(tmpdir(), "path-run-"))
  const site = await startFakeSite({}, {
    "4525": {
      title: "Made-up Certification",
      cards: [
        { type: "course", title: "First made-up course", template: "111" },
        { type: "credential", title: "A made-up badge" },
        { type: "course", title: "Second made-up course", template: "222" },
        { type: "survey", title: "A made-up survey" },
      ],
    },
  })
  t.after(async () => {
    await site.close()
    await rm(base, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 })
  })
  const profile = path.join(base, "profile")
  const address = `${site.url}/paths/4525`

  await t.test("the courses file comes out as JSON, and nothing else, with --json", async () => {
    const run = await runPath(profile, site, [address, "--json"])
    assert.equal(run.code, 0, run.err)
    assert.deepEqual(JSON.parse(run.out), {
      title: "Made-up Certification",
      path: address,
      bundleBase: BUNDLE_BASE,
      courses: [
        { id: "1", template: "111", title: "First made-up course", provider: "private" },
        { id: "2", template: "222", title: "Second made-up course", provider: "private" },
      ],
    })
    assert.equal(await browserClosed(run.port), true, "the browser the command started is closed at the end")
  })

  await t.test("without --json it prints the numbered list a person can read", async () => {
    const run = await runPath(profile, site, [address])
    assert.equal(run.code, 0, run.err)
    assert.match(run.out, /Learning path: Made-up Certification/)
    assert.match(run.out, / {2}1\. First made-up course {2}\(course 111\)/)
    assert.match(run.out, / {2}2\. Second made-up course {2}\(course 222\)/)
    assert.match(run.out, /2 courses, in Google's order\./)
    assert.doesNotMatch(run.out, /badge|survey/, "cards that are not courses are left out")
  })

  await t.test("the path can be given as just its number", async () => {
    const run = await runPath(profile, site, ["4525", "--json"])
    assert.equal(run.code, 0, run.err)
    assert.equal(JSON.parse(run.out).path, address)
  })

  await t.test("a path with no courses is an error that says what to check", async () => {
    const run = await runPath(profile, site, ["9999", "--json"])
    assert.equal(run.code, 1)
    assert.match(run.err, /No courses were found at/)
    assert.equal(run.out, "")
  })

  await t.test("an address that is not a learning path is refused with the usage line, before any browser starts", async () => {
    const run = await runPath(profile, site, ["https://evil.example/paths/4525"])
    assert.equal(run.code, 2)
    assert.match(run.err, /Usage: pnpm --dir quiz reading:path/)
  })
})
