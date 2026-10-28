import assert from "node:assert/strict"
import test from "node:test"
import { copyText } from "./copy.ts"

// A minimal stand-in for the page: a body, a textarea and execCommand, as Safari has them.
function fakePage(opts: { secure: boolean; clipboard?: (text: string) => Promise<void>; execCommand?: () => boolean }) {
  const copied: string[] = []
  const body = { children: [] as unknown[], appendChild(node: unknown) { this.children.push(node) } }
  const area = {
    value: "",
    style: {} as Record<string, string>,
    setAttribute() {},
    select() {},
    setSelectionRange() {},
    remove() { body.children = body.children.filter((child) => child !== area) },
  }
  // Node has its own read-only navigator, so each stand-in is defined rather than assigned.
  const define = (name: string, value: unknown) => Object.defineProperty(globalThis, name, { value, configurable: true, writable: true })
  define("window", { isSecureContext: opts.secure })
  define("navigator", opts.clipboard ? { clipboard: { writeText: opts.clipboard } } : {})
  define("document", {
    body,
    createElement: () => area,
    execCommand: () => {
      copied.push(area.value)
      return opts.execCommand ? opts.execCommand() : true
    },
  })
  return { copied, body }
}

test("a secure page copies through the clipboard API", async () => {
  const written: string[] = []
  fakePage({ secure: true, clipboard: async (text) => { written.push(text) } })
  assert.equal(await copyText("scene"), true)
  assert.deepEqual(written, ["scene"])
})

test("plain http on the LAN falls back to a hidden textarea and leaves nothing behind", async () => {
  const page = fakePage({ secure: false })
  assert.equal(await copyText("scene"), true)
  assert.deepEqual(page.copied, ["scene"])
  assert.equal(page.body.children.length, 0)
})

test("a refused clipboard write falls back too", async () => {
  const page = fakePage({ secure: true, clipboard: async () => { throw new Error("denied") } })
  assert.equal(await copyText("scene"), true)
  assert.deepEqual(page.copied, ["scene"])
})

test("says so when neither way can copy", async () => {
  fakePage({ secure: false, execCommand: () => false })
  assert.equal(await copyText("scene"), false)
})
