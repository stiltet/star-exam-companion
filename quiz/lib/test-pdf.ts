// A tiny PDF built from made-up text, one page per string, for tests. No real document is used.
export function makePdf(pages: string[]): Uint8Array {
  const objects: string[] = []
  const pageIds = pages.map((_, index) => 4 + index * 2)
  objects[1] = "<</Type/Catalog/Pages 2 0 R>>"
  objects[2] = `<</Type/Pages/Kids[${pageIds.map((id) => `${id} 0 R`).join(" ")}]/Count ${pages.length}>>`
  objects[3] = "<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>"
  pages.forEach((text, index) => {
    const id = pageIds[index]
    const stream = `BT /F1 12 Tf 20 100 Td (${text}) Tj ET`
    objects[id] = `<</Type/Page/Parent 2 0 R/MediaBox[0 0 900 200]/Contents ${id + 1} 0 R/Resources<</Font<</F1 3 0 R>>>>>>`
    objects[id + 1] = `<</Length ${stream.length}>>\nstream\n${stream}\nendstream`
  })
  let body = "%PDF-1.4\n"
  const offsets: number[] = []
  for (let id = 1; id < objects.length; id += 1) {
    if (objects[id] === undefined) continue
    offsets[id] = body.length
    body += `${id} 0 obj\n${objects[id]}\nendobj\n`
  }
  const xref = body.length
  body += `xref\n0 ${objects.length}\n0000000000 65535 f \n`
  for (let id = 1; id < objects.length; id += 1) body += `${String(offsets[id] ?? 0).padStart(10, "0")} 00000 n \n`
  body += `trailer\n<</Root 1 0 R/Size ${objects.length}>>\nstartxref\n${xref}\n%%EOF\n`
  return new TextEncoder().encode(body)
}
