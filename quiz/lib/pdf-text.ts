import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs"

// Text of a PDF, for any capture that meets a reading delivered as a PDF. It knows nothing about any site or exam: give it the
// bytes of a PDF, get its text back. The bytes stay in memory; nothing is written to disk.

// A PDF file starts with the characters %PDF.
export function looksLikePdf(bytes: Uint8Array): boolean {
  return bytes.length > 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46
}

// The text of every page (up to maxPages), in reading order, one line per line of the page and a blank line between pages.
export async function pdfText(bytes: Uint8Array, maxPages = 500): Promise<string> {
  if (!looksLikePdf(bytes)) throw new Error("The data is not a PDF.")
  const task = getDocument({
    // A copy, because the library takes ownership of the buffer it is given.
    data: new Uint8Array(bytes),
    useSystemFonts: false,
    disableFontFace: true,
    verbosity: 0,
  })
  try {
    const document = await task.promise
    const pages: string[] = []
    for (let number = 1; number <= Math.min(document.numPages, maxPages); number += 1) {
      const page = await document.getPage(number)
      const content = await page.getTextContent()
      let text = ""
      for (const item of content.items) {
        if (!("str" in item)) continue
        text += item.str
        text += item.hasEOL ? "\n" : ""
      }
      pages.push(text.replace(/[ \t]+\n/g, "\n").trim())
    }
    return pages.filter((page) => page.length > 0).join("\n\n")
  } finally {
    await task.destroy()
  }
}
