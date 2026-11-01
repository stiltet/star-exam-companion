import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { acceptSpeak, clipsToEvict, MAX_CACHED_CLIPS, MAX_SPEAK_CHARS, speechFileName, speechKey, voiceKeys, voiceText } from "./speak.ts"
import { itemsFromGlossary } from "./round.ts"
import { answerAloud, explanationParts, questionClips, saidHeading, speakable } from "./score.ts"
import { parseGlossary } from "./sources.ts"

test("every line the Voice Quiz can say has a key, and only those lines do", () => {
  const parsed = parseGlossary(readFileSync(new URL("../../glossary.md", import.meta.url), "utf8"))
  if (!parsed.ok) throw new Error(`glossary row ${parsed.row}: ${parsed.error}`)
  const items = itemsFromGlossary(parsed.glossary)
  const keys = voiceKeys(items)
  for (const item of items) {
    for (const part of [...questionClips(item.stem, item.options).map((clip) => clip.text), item.constraint, ...explanationParts(item), "Correct.", answerAloud(true, item.options[item.correctIndex] ?? "")]) {
      const key = keys[speakable(part)]
      assert.ok(key, `${item.id}: ${part}`)
      assert.equal(voiceText(items, key), speakable(part).trim())
    }
  }
  assert.equal(`${speechKey("Correct.")}.wav`, speechFileName("Correct."))
  assert.equal(voiceText(items, speechKey("Say anything I like.")), undefined)
  assert.ok(Object.keys(keys).length * 2 < MAX_CACHED_CLIPS, "storing every line never evicts one")
})

const origin = "http://127.0.0.1:3000"
const good = { origin, contentType: "application/json", body: { text: " A scene. " }, allowedOrigin: origin }

test("speech is accepted only as same-origin JSON text, with no voice choice", () => {
  assert.equal(acceptSpeak(good), "A scene.")
  assert.equal(acceptSpeak({ ...good, origin: "http://evil.test" }), null)
  assert.equal(acceptSpeak({ ...good, contentType: "text/plain" }), null)
  assert.equal(acceptSpeak({ ...good, body: { text: "hi", voice: "Daniel" } }), null)
  assert.equal(acceptSpeak({ ...good, body: { text: "   " } }), null)
  assert.equal(acceptSpeak({ ...good, body: { text: "x".repeat(MAX_SPEAK_CHARS + 1) } }), null)
})

test("the same text maps to the same cached file", () => {
  assert.equal(speechFileName("Correct."), speechFileName("Correct."))
  assert.notEqual(speechFileName("Correct."), speechFileName("Incorrect."))
  assert.match(speechFileName("Correct."), /^[0-9a-f]{64}\.wav$/)
})

test("say's embedded [[...]] commands never reach it", () => {
  assert.equal(acceptSpeak({ ...good, body: { text: "[[volm 1.0]] Loud [[rate 400]]now." } }), "Loud now.")
  assert.equal(acceptSpeak({ ...good, body: { text: "[[volm 1.0]]" } }), null)
  assert.ok(!acceptSpeak({ ...good, body: { text: "Fast [[rate 500]x]] now." } })?.includes("[["))
})

test("the cache keeps the newest clips and evicts the oldest past the cap", () => {
  const clips = [
    { name: "c.wav", mtimeMs: 3 },
    { name: "a.wav", mtimeMs: 1 },
    { name: "b.wav", mtimeMs: 2 },
  ]
  assert.deepEqual(clipsToEvict(clips, 3), [])
  assert.deepEqual(clipsToEvict(clips, 1), ["a.wav", "b.wav"])
})

test("abbreviations are spelled the way the owner heard them right, 19 Oct", () => {
  assert.equal(speakable("gen AI tools"), "gen AI tools")
  assert.equal(speakable("an ML model and IAM roles"), "an M-L model and I-A-M roles")
  assert.equal(speakable("the CEO and the CISO use CX"), "the C-E-O and the C-I-S-O use C-X")
  assert.equal(speakable("three APIs, two TPUs and the KPIs"), "three A-P-I's, two T-P-U's and the K-P-I's")
  assert.equal(speakable("RAG with SAIF"), "rag with safe")
  assert.equal(speakable("the ADK and a FAQ bot"), "the Agent Development Kit and a frequently asked questions bot")
  assert.equal(speakable("two FAQs and three ADKs"), "two frequently asked questions and three Agent Development Kits")
  assert.equal(speakable("AIs"), "AIs")
  assert.equal(speakable("**Agent Search** on CCaaS and LiteRT"), "Agent Search on CCaaS and LiteRT")
})

test("words the owner heard wrong in Read Aloud are respelled, 20 Oct", () => {
  assert.equal(speakable("the AI's output and the AI’s answer"), "the A-I's output and the A-I's answer")
  assert.equal(speakable("Veo makes video, Veo 3 too"), "Vay-oh makes video, Vay-oh 3 too")
  assert.equal(speakable("knowledge cut-offs and a Cut-off"), "knowledge cutoffs and a Cutoff")
  assert.equal(speakable("Video and Veolia"), "Video and Veolia")
  assert.equal(speakable("the recipient(s) or system(s)"), "the recipients or systems")
  assert.equal(speakable("This loop continues. Continues, continued."), "This loop contin-yooz. Contin-yooz, continued.")
  assert.equal(speakable("It discontinues."), "It discontinues.")
})

test("a heading is said as a sentence, so a lone word is not misread", () => {
  assert.equal(saidHeading("Performance"), "Performance.")
  assert.equal(saidHeading("Why ground?"), "Why ground?")
  assert.equal(saidHeading("Key takeaway:"), "Key takeaway:")
})
