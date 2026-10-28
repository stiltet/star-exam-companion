import assert from "node:assert/strict"
import test from "node:test"
import { MAX_BODY_BYTES, readJsonBody } from "./body.ts"

const post = (body: string, headers: Record<string, string> = {}) => new Request("http://localhost/api/scores", { method: "POST", body, headers })

test("a small JSON body is parsed", async () => {
  assert.deepEqual(await readJsonBody(post('{"confirm":true}')), { confirm: true })
})

test("a body over the cap is refused, whether or not it declares its length", async () => {
  const big = JSON.stringify({ text: "x".repeat(MAX_BODY_BYTES) })
  assert.equal(await readJsonBody(post(big)), null)
  assert.equal(await readJsonBody(post("{}", { "content-length": String(MAX_BODY_BYTES + 1) })), null)
})

test("a body that is not JSON is refused", async () => {
  assert.equal(await readJsonBody(post("not json")), null)
  assert.equal(await readJsonBody(post("")), null)
})

test("a chunked body with no Content-Length is cut off at the cap, not buffered whole", async () => {
  let pulled = 0
  const endless = new ReadableStream<Uint8Array>({
    pull(controller) {
      pulled += 1
      controller.enqueue(new Uint8Array(1024).fill(32))
    },
  })
  const request = new Request("http://localhost/api/speak", { method: "POST", body: endless, duplex: "half" } as RequestInit)
  assert.equal(await readJsonBody(request), null)
  assert.ok(pulled <= MAX_BODY_BYTES / 1024 + 2, `read ${pulled} KB of an endless body`)
})
