import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { fitClips, markedWords, sentences, spokenClass, spokenPieces, spokenWord, words } from "./spoken-word.ts"

test("text splits into words with their punctuation and spacing kept", () => {
  assert.deepEqual(words("Which product, then?"), ["Which ", "product, ", "then?"])
  assert.equal(words("  two  spaces ").join(""), "  two  spaces ")
})

test("the spoken word follows the play position, longer words taking longer", () => {
  const text = "A retailer needs search."
  assert.equal(spokenWord(text, 0, 2), 0)
  assert.equal(spokenWord(text, 1.99, 2), 3)
  assert.equal(spokenWord(text, 2, 2), 3)
  assert.equal(spokenWord(text, 0.4, 2), 1)
  assert.ok(spokenWord(text, 1, 2) >= 1 && spokenWord(text, 1, 2) <= 2)
})

test("nothing is marked before a duration is known", () => {
  assert.equal(spokenWord("A word.", 0.5, 0), -1)
  assert.equal(spokenWord("A word.", 0.5, Number.NaN), -1)
  assert.equal(spokenWord("", 0.5, 2), -1)
  assert.equal(spokenWord("A word.", 0.5, Number.POSITIVE_INFINITY), -1)
})

test("an option's exam-guide name stays bold, word by word, without its markers", () => {
  assert.deepEqual(markedWords("B. Agent Studio (formerly **Vertex AI Studio**)"), [
    { text: "B. ", bold: false },
    { text: "Agent ", bold: false },
    { text: "Studio ", bold: false },
    { text: "(formerly ", bold: false },
    { text: "Vertex ", bold: true },
    { text: "AI ", bold: true },
    { text: "Studio)", bold: true },
  ])
})

test("the word being said is bold, never highlighted, and an exam-guide name is underlined while said", () => {
  assert.equal(spokenClass(false, false), undefined)
  assert.equal(spokenClass(false, true), "font-bold")
  assert.equal(spokenClass(true, false), "font-bold")
  assert.equal(spokenClass(true, true), "font-bold underline decoration-2")
  for (const [bold, said] of [[false, true], [true, true]] as const) {
    assert.doesNotMatch(spokenClass(bold, said) ?? "", /\bbg-|highlight|yellow/)
  }
})

test("an underline stops before the space after the word, and a bold word keeps its space", () => {
  assert.deepEqual(spokenPieces("Creating_agent ", "font-bold underline decoration-2"), [
    { text: "Creating_agent", className: "font-bold underline decoration-2" },
    { text: " ", className: "font-bold" },
  ])
  assert.deepEqual(spokenPieces("word,  ", "underline decoration-2"), [
    { text: "word,", className: "underline decoration-2" },
    { text: "  " },
  ])
  assert.deepEqual(spokenPieces("instructions", "underline decoration-2"), [
    { text: "instructions", className: "underline decoration-2" },
  ])
  assert.deepEqual(spokenPieces("plain ", "font-bold"), [{ text: "plain ", className: "font-bold" }])
  assert.deepEqual(spokenPieces("end", undefined), [{ text: "end", className: undefined }])
  assert.deepEqual(spokenPieces("  ", "underline"), [{ text: "  ", className: "underline" }])
})

test("read aloud and the voice quiz draw that underline through SpokenSpan", () => {
  const span = readFileSync(new URL("../components/spoken-span.tsx", import.meta.url), "utf8")
  assert.match(span, /spokenPieces\(/)
  for (const file of ["../components/read-aloud.tsx", "../components/voice-quiz.tsx"]) {
    const source = readFileSync(new URL(file, import.meta.url), "utf8")
    assert.match(source, /<SpokenSpan\b/)
    assert.doesNotMatch(source, /underline[^>]*>\{/)
  }
})

test("the voice quiz marks the said word with the shared look", () => {
  const source = readFileSync(new URL("../components/voice-quiz.tsx", import.meta.url), "utf8")
  assert.match(source, /import \{[^}]*\bspokenClass\b[^}]*\} from "@\/lib\/spoken-word"/)
  assert.doesNotMatch(source, /function spokenClass/)
  assert.ok((source.match(/className=\{spokenClass\(/g) ?? []).length >= 2, "the question and every option use it")
  assert.doesNotMatch(source, /<span key=\{wordIndex\} className="/, "no followed word has a look of its own")
})

test("a text splits into sentences that point at their first word", () => {
  const text = "Data helps, e.g. sales. Is it big? Yes! The end"
  const parts = sentences(text)
  assert.deepEqual(parts.map((part) => part.text), ["Data helps, e.g. sales.", "Is it big?", "Yes!", "The end"])
  const list = words(text)
  for (const part of parts) assert.equal(list.slice(part.first).join("").startsWith(part.text), true)
  assert.deepEqual(sentences("One line."), [{ text: "One line.", first: 0 }])
  assert.deepEqual(sentences(""), [])
})

test("initials and abbreviations do not end a sentence, a closing quote stays with its sentence", () => {
  assert.deepEqual(sentences("J. Smith wrote it. Next.").map((part) => part.text), ["J. Smith wrote it.", "Next."])
  assert.deepEqual(sentences('He said "stop." Then went.').map((part) => part.text), ['He said "stop."', "Then went."])
})

test("a sentence too long once said is cut at words, each piece pointing at its first word", () => {
  const text = "AI ML GPU TPU end."
  const spoken = (value: string) => value.replace(/\b([A-Z]{2,})\b/g, (letters) => letters.split("").join("-")).length
  const clips = fitClips([{ text, first: 3 }], spoken, 8)
  assert.ok(clips.length > 1)
  assert.ok(clips.every((clip) => spoken(clip.text) <= 8 || words(clip.text).length === 1))
  const list = words(text)
  for (const clip of clips) assert.equal(list.slice(clip.first - 3).join("").startsWith(clip.text), true)
  assert.deepEqual(fitClips([{ text: "Short.", first: 0 }], spoken, 8), [{ text: "Short.", first: 0 }])
})

test("a line with a full stop inside splits into clips whose first words line up", () => {
  const line = "Customer ID, Step one. Then two, Feedback (on a 1-5 star scale)."
  const all = words(line)
  for (const part of sentences(line)) assert.equal(all.slice(part.first).join("").startsWith(part.text), true)
})
