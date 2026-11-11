import assert from "node:assert/strict"
import test from "node:test"
import { looksLikePdf, pdfText } from "./pdf-text.ts"
import { makePdf } from "./test-pdf.ts"

test("a PDF is recognised by its first bytes, and other data is not", () => {
  assert.equal(looksLikePdf(makePdf(["Synthetic"])), true)
  assert.equal(looksLikePdf(new TextEncoder().encode("<html></html>")), false)
  assert.equal(looksLikePdf(new Uint8Array()), false)
})

test("the text of a PDF comes back page by page, in order", async () => {
  const text = await pdfText(makePdf(["Synthetic first page text", "Synthetic second page text"]))
  assert.equal(text, "Synthetic first page text\n\nSynthetic second page text")
})

test("the page limit stops the reading, and data that is not a PDF is refused", async () => {
  assert.equal(await pdfText(makePdf(["Synthetic one", "Synthetic two"]), 1), "Synthetic one")
  await assert.rejects(() => pdfText(new TextEncoder().encode("not a pdf at all")), /not a PDF/)
})
