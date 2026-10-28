"use client"

import { Fragment, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react"
import { ArrowLeft, ArrowRight, Pause, Play } from "lucide-react"
import { SILENCE, sharedAudio } from "@/components/audio"
import { SpokenSpan } from "@/components/spoken-span"
import { ActionButton, ActionLink } from "@/components/atoms/button"
import { Divider } from "@/components/atoms/divider"
import { Heading, PARAGRAPH_HEADING } from "@/components/atoms/heading"
import { saveAnswer } from "@/components/outbox"
import { useSnapshot } from "@/components/snapshot"
import { needsSaving, readToday } from "@/lib/progress"
import { reviewStop, type Paragraph } from "@/lib/reading"
import { saidHeading, speakable } from "@/lib/score"
import { MAX_SPEAK_CHARS } from "@/lib/speak-limit"
import { fitClips, sentences, spokenWord, words } from "@/lib/spoken-word"

// The pause after a paragraph, a little longer after a heading.
const PAUSE_MS = 350
const HEADING_PAUSE_MS = 700

type Props = {
  // Where the place is kept on this device: "<course>/<page>".
  place: string
  title: string
  paragraphs: Paragraph[]
  next: { href: string; title: string } | null
  // The reading on Google Skills, when it has a review: done there, it is ticked off there.
  // direct is false when only the course page could be linked; the button then says so.
  review: { url: string; direct: boolean } | null
  // Each paragraph a review or a Start button stood before. A page can have several.
  reviewAt: number[]
  // The same reading on Google, when it has videos: most play only there, not on YouTube.
  video: { url: string; direct: boolean } | null
  // For each video, the paragraph after its title and intro, where it stood on Google.
  videoAt: number[]
}

function savedPlace(key: string, count: number): number {
  try {
    const value = Number(window.localStorage.getItem(key))
    return Number.isInteger(value) && value >= 0 && value < count ? value : 0
  } catch {
    // Storage refused (a private window, blocked site data): start at the top, which is safe.
    return 0
  }
}

function keepPlace(key: string, index: number) {
  try {
    window.localStorage.setItem(key, String(index))
  } catch {
    // A private window keeps no place; reading still works.
  }
}

// A word's look: bold when it is part of the bold start Google gave the text; the word being
// said is bold too, or underlined when it is already bold. SpokenSpan keeps that line off the space.
function wordClass(inLead: boolean, said: boolean): string | undefined {
  if (inLead) return said ? "font-bold underline decoration-2" : "font-bold"
  return said ? "font-bold" : undefined
}

// Smooth only for those who have not asked their device to reduce motion.
function motion(): ScrollBehavior {
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"
}

// A paragraph fits when it can be shown whole under the control bar, with a little room around it.
function fits(box: HTMLElement, under: number): boolean {
  return box.offsetHeight <= window.innerHeight - under - 32
}

// Reads a page of the official course aloud, sentence by sentence, in the Mac's voice
// (/api/speak runs `say`), with the word being said in bold, as in the Voice Quiz.
export function ReadAloud({ place, title, paragraphs, next, review, reviewAt, video, videoAt }: Props) {
  // Each review or Start button in the middle of the page stops the voice. One at the very
  // start or after the last paragraph keeps its button at the end, as a video does.
  const reviewStops = reviewAt.filter((at) => reviewStop(review !== null, at, paragraphs.length) !== null)
  const reviewAtEnd = review !== null && reviewStops.length < reviewAt.length
  const videoStops = videoAt.filter((at) => reviewStop(video !== null, at, paragraphs.length) !== null)
  const videoAtEnd = video !== null && videoStops.length < videoAt.length
  const stops = new Set([...reviewStops, ...videoStops])
  const storeKey = `read-place:${place}`
  const [current, setCurrent] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [word, setWord] = useState(-1)
  const [note, setNote] = useState<string | null>(null)
  const [finished, setFinished] = useState(false)
  // Saved as read: when the voice finishes the last paragraph, or with MARK AS READ. Once a day
  // at most, like any answer kept on the device first and sent to the Mac.
  const { lines } = useSnapshot()
  const latestLines = useRef(lines)
  const [saveFailed, setSaveFailed] = useState(false)
  const saving = useRef(false)
  const savedOn = useRef<string | null>(null)
  // The UTC day, as the Mac dates every saved answer (answer.at), so the two always agree.
  const today = () => new Date().toISOString().slice(0, 10)
  const readNow = readToday(lines, place, today())
  const generation = useRef(0)
  const clips = useRef(new Map<string, Promise<Blob>>())
  // Each paragraph's sentences: one clip each, so the marked word cannot drift far.
  const parts = useMemo(
    () =>
      paragraphs.map((paragraph) =>
        fitClips(sentences(paragraph.text), (text) => (paragraph.heading ? saidHeading(speakable(text)) : speakable(text)).length, MAX_SPEAK_CHARS),
      ),
    [paragraphs],
  )
  // The sentence being read or loaded now.
  const at = useRef({ index: 0, sentence: 0 })
  const clipUrl = useRef<string | null>(null)
  const frame = useRef<number | null>(null)
  const gap = useRef<number | null>(null)
  // The clip paused part-way, so Play carries on from the same word.
  const paused = useRef<{ index: number; sentence: number; mine: number } | null>(null)
  const shown = useRef<(HTMLElement | null)[]>([])
  const bar = useRef<HTMLDivElement | null>(null)
  const stopBlocks = useRef<(HTMLElement | null)[]>([])
  // Height of the sticky breadcrumbs. The control bar sticks just under them. The title row scrolls away.
  const [stuck, setStuck] = useState(0)

  useEffect(() => setCurrent(savedPlace(storeKey, paragraphs.length)), [storeKey, paragraphs.length])

  useLayoutEffect(() => {
    const stack = document.querySelector("[data-read-sticky]")
    if (!(stack instanceof HTMLElement)) return
    const apply = () => setStuck(Math.round(stack.getBoundingClientRect().height))
    apply()
    const observer = new ResizeObserver(apply)
    observer.observe(stack)
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    latestLines.current = lines
  }, [lines])

  // savedOn stays set after a save until the day changes, so a second tap before the saved line
  // reaches latestLines adds nothing.
  async function markRead() {
    if (saving.current || !needsSaving(latestLines.current, place, today(), savedOn.current)) return
    saving.current = true
    const saved = await saveAnswer("reading", [place], [])
    if (saved) savedOn.current = today()
    setSaveFailed(!saved)
    saving.current = false
  }

  function stopTracking() {
    if (frame.current !== null) cancelAnimationFrame(frame.current)
    frame.current = null
  }

  function clearGap() {
    if (gap.current !== null) window.clearTimeout(gap.current)
    gap.current = null
  }

  function releaseClip() {
    if (clipUrl.current) URL.revokeObjectURL(clipUrl.current)
    clipUrl.current = null
  }

  // One sentence's clip, asked for once; a failed one is asked for again next time.
  function clip(index: number, sentence: number): Promise<Blob> {
    const key = `${index}:${sentence}`
    const kept = clips.current.get(key)
    if (kept) return kept
    const said = speakable(parts[index]?.[sentence]?.text ?? "")
    const text = paragraphs[index]?.heading ? saidHeading(said) : said
    const loading = fetch("/api/speak/reading", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) })
      .then((response) => (response.ok ? response.blob() : Promise.reject(new Error(`the Mac answered ${response.status}`))))
    clips.current.set(key, loading)
    loading.catch(() => clips.current.delete(key))
    return loading
  }

  // The sentence after this one: the rest of the paragraph first, then the next paragraph.
  function following(index: number, sentence: number): { index: number; sentence: number } | null {
    if (sentence + 1 < (parts[index]?.length ?? 0)) return { index, sentence: sentence + 1 }
    return index + 1 < paragraphs.length ? { index: index + 1, sentence: 0 } : null
  }

  // The word marked is estimated within the sentence, then placed in the whole paragraph.
  function track(index: number, sentence: number, mine: number) {
    const audio = sharedAudio()
    const said = parts[index]?.[sentence]
    if (!said) return
    let last = -2
    const tick = () => {
      if (generation.current !== mine || audio.paused || audio.ended) return
      const now = spokenWord(said.text, audio.currentTime, audio.duration)
      if (now !== last) {
        last = now
        if (now >= 0) setWord(said.first + now)
      }
      frame.current = requestAnimationFrame(tick)
    }
    tick()
  }

  async function run(index: number, mine: number, sentence = 0) {
    at.current = { index, sentence }
    let blob: Blob
    try {
      blob = await clip(index, sentence)
    } catch (error) {
      // A stale run's failure is safe to drop: a newer run owns the voice and reports its own.
      if (generation.current !== mine) return
      setPlaying(false)
      setNote(`The voice for this paragraph could not be loaded (${error instanceof Error ? error.message : String(error)}).`)
      return
    }
    if (generation.current !== mine) return
    // The next sentence's clip is made while this one plays, so the only gap is the pause.
    const then = following(index, sentence)
    if (then) void clip(then.index, then.sentence).catch(() => undefined)
    const audio = sharedAudio()
    releaseClip()
    clipUrl.current = URL.createObjectURL(blob)
    audio.src = clipUrl.current
    audio.onended = () => {
      if (generation.current !== mine) return
      stopTracking()
      releaseClip()
      clips.current.delete(`${index}:${sentence}`)
      if (then && then.index === index) {
        void run(index, mine, then.sentence)
        return
      }
      setWord(-1)
      if (!then) {
        setPlaying(false)
        setFinished(true)
        keepPlace(storeKey, 0)
        void markRead()
        return
      }
      if (stops.has(then.index)) {
        // A review or a video comes here on Google: the voice waits while the owner does it or
        // watches it, and Play carries on with what follows, often the key takeaway.
        setPlaying(false)
        setCurrent(then.index)
        keepPlace(storeKey, then.index)
        // The page stops following the voice once it is paused, so the stop's button is brought into view.
        stopBlocks.current[then.index]?.scrollIntoView({ block: "center" })
        return
      }
      gap.current = window.setTimeout(() => {
        gap.current = null
        if (generation.current !== mine) return
        setCurrent(then.index)
        keepPlace(storeKey, then.index)
        void run(then.index, mine)
      }, paragraphs[index]?.heading ? HEADING_PAUSE_MS : PAUSE_MS)
    }
    try {
      await audio.play()
      if (generation.current !== mine) return
      setNote(null)
      track(index, sentence, mine)
    } catch (error) {
      // A pause tapped while play() was starting aborts it: that is the pause, not a fault.
      if (generation.current !== mine || (error instanceof DOMException && error.name === "AbortError")) return
      setPlaying(false)
      // Shown, not swallowed: the reason is the evidence for why the voice is silent.
      setNote(error instanceof DOMException && error.name === "NotAllowedError"
        ? "This device refused to play the voice. Tap Play again."
        : `The voice could not play (${error instanceof Error ? `${error.name}: ${error.message}` : String(error)}).`)
    }
  }

  // Inside the tap: a silent clip first, so iOS lets the voice play once its clip arrives.
  function playFrom(index: number, sentence = 0) {
    const mine = ++generation.current
    const audio = sharedAudio()
    clearGap()
    stopTracking()
    paused.current = null
    audio.onended = null
    audio.pause()
    audio.src = SILENCE
    void audio.play().catch(() => undefined)
    setCurrent(index)
    keepPlace(storeKey, index)
    setWord(-1)
    setFinished(false)
    setPlaying(true)
    void run(index, mine, sentence)
  }

  function pause() {
    const audio = sharedAudio()
    stopTracking()
    setPlaying(false)
    if (gap.current !== null) {
      // Between paragraphs: Play starts the next one from its first word.
      clearGap()
      generation.current += 1
      paused.current = null
      const after = Math.min(current + 1, paragraphs.length - 1)
      setCurrent(after)
      // Kept now, so a page closed while paused opens at the paragraph Play would start.
      keepPlace(storeKey, after)
      return
    }
    audio.pause()
    if (clipUrl.current) {
      paused.current = { ...at.current, mine: generation.current }
      return
    }
    // The clip is still being made: it must not start once it arrives. Play starts that sentence.
    generation.current += 1
    paused.current = { ...at.current, mine: -1 }
  }

  function play() {
    const audio = sharedAudio()
    const resume = paused.current
    paused.current = null
    if (resume && resume.mine === generation.current && clipUrl.current && !audio.ended) {
      setPlaying(true)
      audio.play().then(() => track(resume.index, resume.sentence, resume.mine)).catch(() => playFrom(resume.index, resume.sentence))
      return
    }
    if (resume && resume.index === current) return playFrom(resume.index, resume.sentence)
    playFrom(finished ? 0 : current)
  }

  function step(by: number) {
    const target = Math.min(Math.max(current + by, 0), paragraphs.length - 1)
    if (playing) playFrom(target)
    else {
      generation.current += 1
      paused.current = null
      sharedAudio().pause()
      setWord(-1)
      setFinished(false)
      setCurrent(target)
      keepPlace(storeKey, target)
    }
  }

  // Leaving the page stops the voice: the audio element is shared with the rest of the app.
  useEffect(() => {
    return () => {
      generation.current += 1
      if (gap.current !== null) window.clearTimeout(gap.current)
      if (frame.current !== null) cancelAnimationFrame(frame.current)
      const audio = sharedAudio()
      audio.onended = null
      audio.pause()
      if (clipUrl.current) URL.revokeObjectURL(clipUrl.current)
    }
  }, [])

  // While the voice is playing, the paragraph stays in view: centred in the space under the
  // header when it fits, otherwise with its start just under the bar. Nothing is padded in,
  // so the page at rest starts under the controls.
  useEffect(() => {
    if (!playing) return
    const box = shown.current[current]
    const under = (bar.current?.offsetHeight ?? 0) + stuck
    if (box) box.scrollIntoView({ block: fits(box, under) ? "center" : "start", behavior: motion() })
  }, [current, playing, stuck])

  // In a paragraph taller than the screen the page follows the word being said: once it passes
  // two thirds of the way down, it is brought back to a third.
  useEffect(() => {
    if (!playing || word <= 0) return
    const box = shown.current[current]
    const said = box?.querySelector(`[data-word="${word}"]`)
    const under = (bar.current?.offsetHeight ?? 0) + stuck
    if (!box || !said || fits(box, under)) return
    const room = window.innerHeight - under
    const { top, bottom } = said.getBoundingClientRect()
    if (top >= under && bottom <= under + (room * 2) / 3) return
    window.scrollBy({ top: top - (under + room / 3), behavior: motion() })
  }, [word, current, playing, stuck])

  // Full width on a phone, its own width from sm up: placement only, the look is the atom's.
  const wide = "self-stretch sm:self-start"
  const hintId = useId()
  const nextId = useId()
  const reviewButton = review && (
    <ActionLink variant="filled" placement={wide} href={review.url} arrow>
      {review.direct ? "DO THE REVIEW ON GOOGLE" : "OPEN THE COURSE ON GOOGLE TO DO THE REVIEW"}
    </ActionLink>
  )
  const videoButton = video && (
    <ActionLink variant="filled" placement={wide} href={video.url} arrow>
      {video.direct ? "WATCH THE VIDEO" : "OPEN THE COURSE TO WATCH THE VIDEO"}
    </ActionLink>
  )
  // On Google the video comes first and the review straight after it, so one button opens the
  // video and covers both (owner, 21 Oct).
  const bothButton = video && review && (
    <ActionLink variant="filled" placement={wide} href={video.url} arrow>
      {video.direct ? "WATCH VIDEO AND DO REVIEW" : "OPEN THE COURSE TO WATCH VIDEO AND DO REVIEW"}
    </ActionLink>
  )
  // "Next" is a title over the button, which carries the reading's own title (owner, 20 Oct).
  // Named by its heading, so a screen reader hears "Next" with the link it holds. A line sits
  // directly above it when a review or a video button is already above that (owner, 21 Oct).
  const nextLink = next && (
    <nav aria-labelledby={nextId} className="flex flex-col gap-4">
      {(reviewAtEnd || videoAtEnd) && <Divider />}
      <Heading variant="section" id={nextId}>Next:</Heading>
      <ActionLink variant="filled" placement={wide} href={next.href} arrow>
        {next.title}
      </ActionLink>
    </nav>
  )

  // The reading's own title is 28px (owner, 21 Oct). A section heading under it stays text-xl.
  const titleIsFirstLine = paragraphs[0]?.heading === true && paragraphs[0].text === title
  // A reading that is only a review has nothing to read aloud here.
  if (paragraphs.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <Heading variant="title" placement="mb-4">{title}</Heading>
        <p>This reading is a review. Do it on Google, where it is ticked off.</p>
        {reviewButton}
        {nextLink}
      </div>
    )
  }

  // Clears the stuck breadcrumbs, then the same room the control bar had when it alone stuck to the top.
  const scrollMargin = { scrollMarginTop: stuck + 96 }
  return (
    <div>
      {/* A page whose first line is its title shows that line once, there, and still reads it aloud. */}
      <Heading variant="title" placement={titleIsFirstLine ? "sr-only" : "mb-4"}>{title}</Heading>
      {/* Below the breadcrumb bar. The title row is not sticky, so it scrolls away. */}
      {/* -mx-4 px-4 fills the page padding, so the bar's background covers the current paragraph's mark beside the arrows. */}
      <div ref={bar} style={{ top: stuck }} className="sticky z-30 -mx-4 bg-background border-b-2 border-foreground px-4 py-3 mb-4 flex items-center gap-3">
        <button type="button" className="border-2 border-foreground px-3 py-2 inline-flex items-center gap-2 disabled:opacity-40" disabled={current === 0} onClick={() => step(-1)} aria-label="Previous paragraph">
          <ArrowLeft aria-hidden="true" size={18} />
        </button>
        <button
          type="button"
          className="border-2 border-foreground px-4 py-2 inline-flex items-center gap-2 bg-foreground text-background"
          onClick={() => (playing ? pause() : play())}
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? <Pause aria-hidden="true" size={18} /> : <Play aria-hidden="true" size={18} />}
          <span>{playing ? "Pause" : "Play"}</span>
        </button>
        <button type="button" className="border-2 border-foreground px-3 py-2 inline-flex items-center gap-2 disabled:opacity-40" disabled={current >= paragraphs.length - 1} onClick={() => step(1)} aria-label="Next paragraph">
          <ArrowRight aria-hidden="true" size={18} />
        </button>
        <span className="ml-auto text-sm text-muted-foreground">{current + 1} / {paragraphs.length}</span>
      </div>
      {note && <p role="alert" className="mb-4 font-bold">{note}</p>}
      <div className="flex flex-col gap-4 text-lg">
        {paragraphs.map((paragraph, index) => {
          const now = index === current
          const bold = paragraph.lead ? words(paragraph.lead).length : 0
          // data-word lets the page find the word being said in a paragraph taller than the screen.
          const said = paragraph.lead
            ? words(paragraph.text).map((part, partIndex) => (
                <SpokenSpan key={partIndex} wordIndex={partIndex} className={wordClass(partIndex < bold, now && partIndex === word)} text={part} />
              ))
            : now && word >= 0
            ? words(paragraph.text).map((part, partIndex) => (
                <SpokenSpan key={partIndex} wordIndex={partIndex} className={partIndex === word ? (paragraph.heading ? "underline decoration-2" : "font-bold") : undefined} text={part} />
              ))
            : paragraph.text
          // A bullet as on Google's page; spans, not <li>, since it sits inside
          // the paragraph's button.
          const text = paragraph.bullet ? (
            <span className="flex gap-3">
              <span aria-hidden="true">•</span>
              <span className="min-w-0 break-words">{said}</span>
            </span>
          ) : said
          return (
            <Fragment key={index}>
            {stops.has(index) && (
              <section
                ref={(element) => {
                  stopBlocks.current[index] = element
                }}
                aria-label={reviewStops.includes(index) ? (videoStops.includes(index) ? "Video and review" : "Review") : "Video"}
                style={scrollMargin}
                className="flex flex-col gap-4 border-y-2 border-foreground py-4"
              >
                {reviewStops.includes(index) && videoStops.includes(index)
                  ? bothButton
                  : reviewStops.includes(index) ? reviewButton : videoButton}
              </section>
            )}
            <button
              type="button"
              ref={(element) => {
                shown.current[index] = element
              }}
              onClick={() => playFrom(index)}
              aria-current={now ? "true" : undefined}
              style={scrollMargin}
              className={`block w-full text-left px-2 ${now ? "shadow-[-4px_0_0_0_var(--foreground)]" : ""} ${paragraph.heading ? (titleIsFirstLine && index === 0 ? PARAGRAPH_HEADING.first : PARAGRAPH_HEADING.other) : ""}`}
            >
              {text}
            </button>
            </Fragment>
          )
        })}
      </div>
      <div className="mt-4 flex flex-col gap-4">
        {/* Where to go next comes first, under a line, then MARK AS READ (owner, 20 Oct). */}
        {((reviewAtEnd && reviewButton) || videoAtEnd || nextLink) && (
          <div className="flex flex-col gap-4">
            <Divider />
            {reviewAtEnd && reviewButton && videoAtEnd ? bothButton : (
              <>
                {reviewAtEnd && reviewButton}
                {videoAtEnd && videoButton}
              </>
            )}
            {nextLink}
          </div>
        )}
        {/* The status line is always there, so a screen reader hears it change; it sits below both
            buttons (owner, 20 Oct), and once saved the button says so and the line is for screen
            readers only. The button stays put, so focus is not lost when it is used. */}
        <ActionButton variant="outlined" placement={wide} onClick={() => void markRead()} aria-disabled={readNow} aria-describedby={hintId}>
          {readNow ? "✓ MARKED AS READ TODAY" : "MARK AS READ"}
        </ActionButton>
        <p id={hintId} role="status" className={readNow ? "sr-only" : "text-sm text-muted-foreground"}>
          {readNow ? "Saved as read today." : "Marked as read on its own when the voice reaches the end."}
        </p>
        {saveFailed && <p role="alert">Not saved: this device could not keep it and the Mac could not be reached. Try again.</p>}
      </div>
    </div>
  )
}
