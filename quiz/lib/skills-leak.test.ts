import assert from "node:assert/strict"
import { readdirSync, readFileSync, statSync } from "node:fs"
import path from "node:path"
import test from "node:test"
import { testRoot } from "./test-pack.ts"

// The public skills in skills/ are published with the repository, so they must hold steps only: no home path, no machine address, no
// token, no e-mail address other than the owner's public one. This runs in every clone, so a later edit cannot leak one unseen.

const OWNER_EMAIL = "stiltet@gmail.com"

function skillFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const file = path.join(directory, name)
    return statSync(file).isDirectory() ? skillFiles(file) : [file]
  })
}

const files = skillFiles(path.join(testRoot, "skills"))

test("there are public skills to check", () => {
  assert.ok(files.some((file) => file.endsWith(path.join("capture-reading", "SKILL.md"))))
  assert.ok(files.some((file) => file.endsWith(path.join("add-exam", "SKILL.md"))))
})

const RULES: { name: string; pattern: RegExp }[] = [
  { name: "a home path", pattern: /\/(?:Users|home)\/[A-Za-z0-9._-]+/ },
  { name: "a private network address", pattern: /\b(?:10\.\d{1,3}|192\.168|172\.(?:1[6-9]|2\d|3[01]))\.\d{1,3}\.\d{1,3}\b/ },
  { name: "a token or key", pattern: /\b(?:ghp_|github_pat_|sk-[A-Za-z0-9]{16,}|AKIA[0-9A-Z]{12,}|xox[bap]-)[A-Za-z0-9_-]*/ },
  { name: "a long hex or base64 secret", pattern: /\b[A-Fa-f0-9]{40,}\b|\b[A-Za-z0-9+/]{48,}={0,2}(?=\s|$)/ },
  { name: "a private key", pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
]

test("no skill holds a home path, a machine address, a token or a key", () => {
  for (const file of files) {
    const text = readFileSync(file, "utf8")
    for (const rule of RULES) assert.equal(rule.pattern.test(text), false, `${path.relative(testRoot, file)} holds ${rule.name}`)
  }
})

test("no skill names an e-mail address other than the owner's public one", () => {
  for (const file of files) {
    const text = readFileSync(file, "utf8")
    for (const address of text.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) ?? []) {
      assert.ok(address.toLowerCase() === OWNER_EMAIL || /@example\.(?:test|com|org)$/.test(address), `${path.relative(testRoot, file)} names ${address}`)
    }
  }
})

test("the rules catch what they are meant to", () => {
  assert.equal(RULES[0]!.pattern.test("cd /Users/someone/Projects"), true)
  assert.equal(RULES[1]!.pattern.test("http://192.168.1.20:3000"), true)
  assert.equal(RULES[1]!.pattern.test("http://127.0.0.1:3000"), false)
  assert.equal(RULES[2]!.pattern.test("ghp_abcdefghijklmnop"), true)
})
