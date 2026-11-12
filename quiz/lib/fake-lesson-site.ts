import { createServer, type ServerResponse } from "node:http"
import type { AddressInfo } from "node:net"
import { makePdf } from "./test-pdf.ts"

// A small local site that looks, to the reading crawl, like the course pages of Google Skills: a course page that lists lesson
// cards, lesson pages that embed the reading in a frame, and the frames. Every title and text is made up by the test.

// How long a drop-first lesson refuses every request after its first one.
const DROP_WINDOW_MS = 150

export type FakeLesson = {
  title: string
  // bundle and document: a lesson page whose frame holds the text, listed as an html bundle or as a document.
  // settle: the text changes shortly after the frame loads, as the real ones do.
  // pdf: the frame is a PDF. notext: the frame holds almost no text.
  // drop-first: every request for the lesson page in the first moments is cut off, so the crawl has to try again.
  kind?: "bundle" | "document" | "settle" | "pdf" | "notext" | "drop-first"
  // One line, so the text a page shows is exactly this text.
  text: string
}
// A card that is not a lesson: a quiz, or another kind such as a lab or a video, named in other.
// A video card links to a video page; the crawl must never open it, which the site counts in videoPagesOpened.
export type FakeCard = FakeLesson | { title: string; quiz: true } | { title: string; other: string } | { title: string; video: true }

export type FakeSite = {
  url: string
  port: number
  // True: every lesson page sends the visitor to the sign-in page, as a signed-out visitor is.
  signedOut: boolean
  // The addresses the account settings page shows (one, as the real page does, unless a test says otherwise).
  addresses: string[]
  // How many times a video page was opened.
  videoPagesOpened: number
  // Changes the text of the first lesson with this title, as Google changing a lesson would.
  setText: (title: string, text: string) => void
  close: () => Promise<void>
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}

function send(response: ServerResponse, status: number, type: string, body: string | Uint8Array, headers: Record<string, string> = {}): void {
  response.writeHead(status, { "content-type": type, ...headers })
  response.end(body)
}

// JSON for a <script> block. JSON.stringify leaves < > & and the two line separators as they are, so a text with </script> in it would
// end the block: they are written as escapes, and the page still reads the same value.
export function jsonForScript(value: string): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029")
}

// A learning-path page: a title and cards. A card with a template is a course and links to it.
export type FakePath = { title: string; cards: { type: string; title: string; template?: string }[] }

// courses: the cards of each course page, by course template number. paths: the learning-path pages, by path number.
export async function startFakeSite(courses: Record<string, FakeCard[]>, paths: Record<string, FakePath> = {}): Promise<FakeSite> {
  let nextId = 1000
  type Entry = { id: number; template: string; lesson: FakeLesson; hits: number; firstHitAt?: number }
  const lessons = new Map<string, Entry>()
  const pages = new Map<string, { card: FakeCard; id: number | null }[]>()
  for (const [template, cards] of Object.entries(courses)) {
    pages.set(template, cards.map((card) => {
      if ("quiz" in card || "other" in card) return { card, id: null }
      const id = nextId
      nextId += 1
      if ("video" in card) return { card, id }
      lessons.set(String(id), { id, template, lesson: card, hits: 0 })
      return { card, id }
    }))
  }

  const site: FakeSite = {
    url: "",
    port: 0,
    signedOut: false,
    addresses: ["synthetic.user@example.test"],
    videoPagesOpened: 0,
    setText(title, text) {
      for (const entry of lessons.values()) {
        if (entry.lesson.title === title) {
          entry.lesson.text = text
          return
        }
      }
      throw new Error(`No fake lesson called ${title}.`)
    },
    close: async () => {},
  }

  const server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1")
    const parts = url.pathname.split("/").filter(Boolean)

    // The home page offers a "Sign in" link only to a signed-out visitor, as the real one does.
    if (parts.length === 0) {
      const link = site.signedOut ? '<a href="/users/sign_in">Sign in</a>' : "<a href=\"/dashboard\">Dashboard</a>"
      return send(response, 200, "text/html", `<html><body>Home ${link}</body></html>`)
    }

    // A learning-path page lists its courses as cards, in order.
    if (parts[0] === "paths" && parts.length === 2) {
      // Own keys only, so a name such as constructor is simply not a path.
      const path = Object.hasOwn(paths, parts[1]) ? paths[parts[1]] : undefined
      if (!path) return send(response, 404, "text/plain", "No such path")
      const cards = path.cards.map((card) => {
        const link = card.template ? `<a href="/paths/${escapeHtml(parts[1])}/course_templates/${escapeHtml(card.template)}">${escapeHtml(card.title)}</a>` : ""
        return `<ql-activity-card type="${escapeHtml(card.type)}" name="${escapeHtml(card.title)}">${link}</ql-activity-card>`
      }).join("\n")
      return send(response, 200, "text/html", `<html><body><h1>${escapeHtml(path.title)}</h1>\n${cards}\n</body></html>`)
    }

    // A course page lists its lessons as cards, as the real one does: a card is an element with a type, a name and a link.
    if (parts[0] === "course_templates" && parts.length === 2) {
      const cards = pages.get(parts[1])
      if (!cards) return send(response, 404, "text/plain", "No such course")
      const html = cards.map(({ card, id }) => {
        if (id === null) return `<ql-activity-card type="${"other" in card ? escapeHtml(card.other) : "quiz"}" name="${escapeHtml(card.title)}"></ql-activity-card>`
        if ("video" in card) return `<ql-activity-card type="video" name="${escapeHtml(card.title)}"><a href="/course_sessions/7/video/${id}">${escapeHtml(card.title)}</a></ql-activity-card>`
        const lesson = card as FakeLesson
        const document = lesson.kind === "document" || lesson.kind === "pdf"
        const type = document ? "link" : "html_bundle"
        const href = `/course_sessions/7/${document ? "documents" : "html_bundles"}/${id}`
        return `<ql-activity-card type="${type}" name="${escapeHtml(lesson.title)}"><a href="${href}">${escapeHtml(lesson.title)}</a></ql-activity-card>`
      }).join("\n")
      return send(response, 200, "text/html", `<html><body><h1>Course</h1>\n${html}\n</body></html>`)
    }

    // A video page, which the crawl never opens: opening one plays it and marks it watched.
    if (parts[0] === "course_templates" && parts[2] === "video") {
      site.videoPagesOpened += 1
      return send(response, 200, "text/html", "<html><body>video</body></html>")
    }

    // A lesson page: a signed-out visitor goes to sign in; otherwise the page embeds the reading in a frame.
    if (parts[0] === "course_templates" && parts.length === 4 && (parts[2] === "html_bundles" || parts[2] === "documents")) {
      if (site.signedOut) return send(response, 302, "text/plain", "", { location: "/users/sign_in" })
      const entry = lessons.get(parts[3])
      if (!entry) return send(response, 404, "text/plain", "No such lesson")
      // Every request in a short window after the first is cut off, however many quiet tries the browser makes of its own, so the failure
      // always reaches the crawl, which then tries again after its own short wait and finds the page back.
      if (entry.lesson.kind === "drop-first") {
        if (entry.firstHitAt === undefined) entry.firstHitAt = Date.now()
        if (Date.now() - entry.firstHitAt < DROP_WINDOW_MS) {
          entry.hits += 1
          request.socket.destroy()
          return
        }
      }
      entry.hits += 1
      const source = entry.lesson.kind === "pdf" ? `/pdf/${entry.id}.pdf` : `/frame/${entry.id}`
      return send(response, 200, "text/html", `<html><body><main>Lesson</main><iframe src="${source}" width="600" height="400"></iframe></body></html>`)
    }

    // The sign-in page has a "Sign in with Google" button. The browser already holds the Google session, so the button signs the
    // visitor in and sends them back to the home page, as the real one does.
    if (parts[0] === "users" && parts[1] === "sign_in") {
      return send(response, 200, "text/html", '<html><body><button onclick="location=\'/auth/google\'">Sign in with Google</button></body></html>')
    }
    // The account settings page shows the signed-in address in a field; a signed-out visitor is sent to sign in. The address is made up.
    if (parts[0] === "users" && parts[1] === "edit") {
      if (site.signedOut) return send(response, 302, "text/plain", "", { location: "/users/sign_in" })
      return send(response, 200, "text/html", `<html><body>${site.addresses.map((address) => `<input value="${escapeHtml(address)}">`).join("")}</body></html>`)
    }
    if (parts[0] === "auth" && parts[1] === "google") {
      site.signedOut = false
      return send(response, 302, "text/plain", "", { location: "/" })
    }

    // The reading itself.
    if (parts[0] === "frame" && parts.length === 2) {
      const entry = lessons.get(parts[1])
      if (!entry) return send(response, 404, "text/plain", "No such frame")
      if (entry.lesson.kind === "settle") {
        const placeholder = "Loading placeholder text that is long enough to look like a finished reading."
        return send(response, 200, "text/html", `<html><body><p id="t">${placeholder}</p><script>setTimeout(function(){document.getElementById("t").textContent=${jsonForScript(entry.lesson.text)}},800)</script></body></html>`)
      }
      return send(response, 200, "text/html", `<html><body><p>${escapeHtml(entry.lesson.text)}</p></body></html>`)
    }
    if (parts[0] === "pdf" && parts.length === 2) {
      const entry = lessons.get(parts[1].replace(/\.pdf$/, ""))
      if (!entry) return send(response, 404, "text/plain", "No such pdf")
      return send(response, 200, "application/pdf", makePdf([entry.lesson.text]))
    }
    return send(response, 404, "text/plain", "Not found")
  })

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const port = (server.address() as AddressInfo).port
  site.port = port
  site.url = `http://127.0.0.1:${port}`
  site.close = () => new Promise<void>((resolve) => {
    server.closeAllConnections()
    server.close(() => resolve())
  })
  return site
}
