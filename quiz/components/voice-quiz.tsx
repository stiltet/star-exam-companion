"use client"

import { useEffect, useRef, useState } from "react"
import { ControlButton } from "@/components/atoms/button"
import { Heading } from "@/components/atoms/heading"
import { sectionJump, sectionLabel, sectionPosition } from "@/lib/progress"
import { ArrowLeft, ArrowRight, CircleHelp, Play, Repeat, Square } from "lucide-react"
import { Names } from "@/components/names"
import { SpokenSpan } from "@/components/spoken-span"
import { SILENCE, sharedAudio } from "@/components/audio"
import { loadClip } from "@/components/voice-cache"
import { saveAnswer, useWaiting } from "@/components/outbox"
import { copyText } from "@/lib/copy"
import type { RoundItem } from "@/lib/learn"
import { markedWords, spokenClass, spokenWord, words } from "@/lib/spoken-word"
import { CONTROLS, startsReading } from "@/lib/start-gesture"
import { answerAloud, discussText, explanationParts, explanationShown, optionLetter, PAUSE_IN_EXPLANATION_MS, questionClips, speakable } from "@/lib/score"

// The exam-guide name for the section now on screen. A section with no published share
// keeps the number and drops the percentage.
function sectionTitle(position: { section: number } | null, sections: { id: number; weight: number }[]): string {
  if (!position) return "Questions"
  const weight = sections.find((section) => section.id === position.section)?.weight
  return weight ? sectionLabel(position.section, weight) : `Section ${position.section}`
}

type Props = {
  round: RoundItem[]
  total: number
  namesChecked: string | null
  voice: Record<string, string>
  sections: { id: number; weight: number }[]
}

export function VoiceQuiz({ round, total, namesChecked, voice, sections }: Props) {
  const [index, setIndex] = useState(0)
  const [picked, setPicked] = useState<number | null>(null)
  // The choice made for each question answered in this round, by question number.
  const [answered, setAnswered] = useState<Record<number, number>>({})
  const [unsaved, setUnsaved] = useState(0)
  const { waiting } = useWaiting()
  const [hintOpen, setHintOpen] = useState(false)
  const speakGeneration = useRef(0)
  const advanceTimer = useRef<number | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [voiceNote, setVoiceNote] = useState<string | null>(null)
  const [copyNote, setCopyNote] = useState<string | null>(null)
  const [needsStart, setNeedsStart] = useState(false)
  // The part (0 = the question, then each option) and word the voice is saying now, or null.
  const [spoken, setSpoken] = useState<{ part: number; word: number } | null>(null)
  // Which reading the marked word belongs to. A question and its explanation both use part numbers.
  const [followKind, setFollowKind] = useState<"question" | "explanation" | null>(null)
  const followFrame = useRef<number | null>(null)
  const explanationRef = useRef<HTMLParagraphElement>(null)
  const scrollToExplanation = useRef(false)

  function stopFollowing() {
    if (followFrame.current !== null) cancelAnimationFrame(followFrame.current)
    followFrame.current = null
    setSpoken(null)
  }
  const item = round[index]
  const position = sectionPosition(round, index)
  const jumps = sectionJump(round, index)

  // A copy note belongs to the question it was copied from.
  // eslint-disable-next-line react-hooks/set-state-in-effect -- resets per-view state when the view changes
  useEffect(() => setCopyNote(null), [index])

  function stopSpeaking() {
    speakGeneration.current += 1
    if (advanceTimer.current !== null) {
      window.clearTimeout(advanceTimer.current)
      advanceTimer.current = null
    }
    stopAudio()
  }

  // The app-wide audio element: the first tap in the app unlocked it, so it may play now.
  function player(): HTMLAudioElement {
    if (!audioRef.current) audioRef.current = sharedAudio()
    return audioRef.current
  }

  // The object URL of the clip now loaded, revoked when it is stopped or replaced.
  const clipUrl = useRef<string | null>(null)

  function releaseClip() {
    if (clipUrl.current) URL.revokeObjectURL(clipUrl.current)
    clipUrl.current = null
  }

  function stopAudio() {
    audioRef.current?.pause()
    releaseClip()
    stopFollowing()
  }

  // The Mac speaks each clip with its System voice (/api/speak runs `say`), and the page plays it.
  // `follow`, when given, is each clip's text as shown, so its current word can be marked. `place`
  // maps a clip to the part it belongs to and the word offset inside that part, since an option's
  // letter and name are separate clips.
  function speakParts(parts: string[], pauseAfter: (partIndex: number) => number, after?: () => void, follow?: string[], place?: (clipIndex: number) => { part: number; offset: number }) {
    if (typeof window === "undefined") {
      after?.()
      return
    }
    const mine = ++speakGeneration.current
    stopAudio()
    // Ask for every part at once, so the only gaps are the pauses. A line the quiz wrote itself is
    // fetched by key, which the service worker keeps on the device for offline rounds.
    const clips = parts.map((part) => {
      const text = speakable(part)
      const key = voice[text]
      if (key) return loadClip(`/api/speak/${key}`)
      return fetch("/api/speak", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) })
        .then((response) => (response.ok ? response.blob() : Promise.reject(new Error(`the Mac answered ${response.status}`))))
    })
    for (const clip of clips) clip.catch(() => undefined)

    async function play(partIndex: number) {
      if (speakGeneration.current !== mine || partIndex >= parts.length) return
      let blob: Blob
      try {
        blob = await clips[partIndex]!
      } catch (error) {
        // Not swallowed: the note shows the reason on the page, and the quiz goes on without sound.
        setVoiceNote(`The voice for this part could not be loaded (${error instanceof Error ? error.message : String(error)}).`)
        return
      }
      if (speakGeneration.current !== mine) return
      releaseClip()
      const url = URL.createObjectURL(blob)
      clipUrl.current = url
      const audio = player()
      audio.src = url
      audio.onended = () => {
        if (followFrame.current !== null) cancelAnimationFrame(followFrame.current)
        followFrame.current = null
        setSpoken(null)
        releaseClip()
        window.setTimeout(() => {
          if (speakGeneration.current !== mine) return
          if (partIndex + 1 < parts.length) void play(partIndex + 1)
          else after?.()
        }, pauseAfter(partIndex))
      }
      try {
        await audio.play()
        setVoiceNote(null)
        setNeedsStart(false)
        const shown = follow?.[partIndex]
        if (shown !== undefined) {
          let last = -2
          const track = () => {
            if (speakGeneration.current !== mine || audio.ended) return
            const word = spokenWord(shown, audio.currentTime, audio.duration)
            if (word !== last) {
              last = word
              const at = place?.(partIndex) ?? { part: partIndex, offset: 0 }
              setSpoken({ part: at.part, word: word + at.offset })
            }
            followFrame.current = requestAnimationFrame(track)
          }
          track()
        }
      } catch (error) {
        if (speakGeneration.current !== mine) return
        if (error instanceof DOMException && error.name === "NotAllowedError") setNeedsStart(true)
        // Shown, not swallowed: any other refusal is the evidence for why the voice is silent.
        else setVoiceNote(`The voice could not play (${error instanceof Error ? `${error.name}: ${error.message}` : String(error)}).`)
      }
    }

    void play(0)
  }

  function speak(text: string, after?: () => void) {
    speakParts([text], () => 0, after)
  }

  function speakQuestion(entry: RoundItem) {
    setFollowKind("question")
    const clips = questionClips(entry.stem, entry.options)
    const shown = clips.map((clip) => clip.text.replace(/\*\*/g, ""))
    speakParts(clips.map((clip) => clip.text), (index) => clips[index]?.pauseAfter ?? 0, undefined, shown, (index) => ({ part: clips[index]?.part ?? 0, offset: clips[index]?.offset ?? 0 }))
  }

  function start() {
    if (!item) return
    const audio = player()
    audio.src = SILENCE
    void audio.play().catch(() => undefined)
    setNeedsStart(false)
    speakQuestion(item)
  }

  // iOS lets a page play sound only from a user gesture (WebKit: "Safari on iOS has required a user
  // gesture to play media"), so after a reload the first sound is refused. Then the next touch
  // anywhere on the page starts the reading, inside that touch. A touch on a control is left to it
  // (lib/start-gesture), so the Start button and an answer each run once.
  useEffect(() => {
    if (!needsStart) return
    // WebKit counts touchend, click and key presses as the gesture that allows sound; pointerdown
    // is not one, so it is not listened to. The first to fire wins: it removes the others.
    const events = ["touchend", "click", "keydown"] as const
    const touched = (event: Event) => {
      const onControl = event.target instanceof Element && event.target.closest(CONTROLS) !== null
      const key = event instanceof KeyboardEvent ? event.key : undefined
      if (!startsReading({ type: event.type, key, onControl })) return
      for (const name of events) document.removeEventListener(name, touched, { capture: true })
      start()
    }
    for (const name of events) document.addEventListener(name, touched, { capture: true })
    return () => {
      for (const name of events) document.removeEventListener(name, touched, { capture: true })
    }
  })

  useEffect(() => {
    return () => {
      speakGeneration.current += 1
      if (advanceTimer.current !== null) {
        window.clearTimeout(advanceTimer.current)
        advanceTimer.current = null
      }
      stopAudio()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- runs when the listed values change, not on every render of the others
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resets per-view state when the view changes
    setHintOpen(false)
  }, [index])

  // A new question starts at the top of the page, so a long explanation from the last one
  // never leaves the new question scrolled out of view. A wrong answer scrolls to its explanation.
  const shownIndex = useRef(index)
  useEffect(() => {
    if (shownIndex.current === index) return
    shownIndex.current = index
    window.scrollTo({ top: 0, left: 0, behavior: "auto" })
  }, [index])

  // After Previous section or Next section, focus moves to the new question's heading, so it is not
  // lost when the pressed button goes away at the first or last section.
  const questionHeading = useRef<HTMLHeadingElement>(null)
  const focusQuestion = useRef(false)
  useEffect(() => {
    if (!focusQuestion.current) return
    focusQuestion.current = false
    questionHeading.current?.focus({ preventScroll: true })
  }, [index])

  useEffect(() => {
    if (!scrollToExplanation.current) return
    scrollToExplanation.current = false
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    explanationRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" })
  }, [picked])

  useEffect(() => {
    if (!item || picked !== null) return
    const timer = window.setTimeout(() => speakQuestion(item), 300)
    return () => window.clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps -- runs when the listed values change, not on every render of the others
  }, [item, picked])

  // Right: says so and moves on. Wrong: says the answer, why it is right and the binding constraint, then moves on.
  function choose(option: number) {
    if (!item || picked !== null) return
    const correct = option === item.correctIndex
    setPicked(option)
    setAnswered((current) => ({ ...current, [index]: option }))
    if (!correct) scrollToExplanation.current = true
    setFollowKind(correct ? null : "explanation")
    const parts = correct ? [answerAloud(true, item.options[item.correctIndex] ?? "")] : explanationParts(item)
    const follow = correct ? undefined : explanationShown(item)
    speakParts(parts, (part) => (part < parts.length - 1 ? PAUSE_IN_EXPLANATION_MS : 0), () => {
      if (index >= round.length - 1) return
      advanceTimer.current = window.setTimeout(() => {
        advanceTimer.current = null
        goTo(index + 1)
      }, 600)
    }, follow)
    void saveAnswer("round", [item.id], correct ? [] : [item.id]).then((kept) => {
      // A lost save is counted on the page, never dropped: the round would otherwise look saved.
      if (!kept) setUnsaved((count) => count + 1)
    })
  }

  // A question answered earlier opens as it was left: the right choice green, a wrong pick red.
  function goTo(target: number) {
    if (target < 0 || target >= round.length) return
    stopSpeaking()
    setIndex(target)
    setPicked(answered[target] ?? null)
  }

  function openSection(target: number | null) {
    if (target === null) return
    focusQuestion.current = true
    goTo(target)
  }

  async function discuss() {
    if (!item || picked === null) return
    const copied = await copyText(discussText({
      stem: item.stem,
      options: item.options,
      yours: item.options[picked] ?? "",
      right: item.options[item.correctIndex] ?? "",
      constraint: item.constraint,
    }))
    setCopyNote(copied ? "Copied. Paste it in the Claude app." : "Could not copy. Select the question text and copy it by hand.")
  }

  if (!item) {
    return (
      <div>
        <Heading variant="page" placement="sr-only">Voice Quiz</Heading>
        <p className="text-lg">
          {total > 0
            ? `All ${total} questions are answered correctly. To ask them again, reset progress on the Progress page.`
            : "The glossary has no terms to ask."}
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col">
      <Heading variant="page" placement="sr-only">Voice Quiz</Heading>
      <div className="relative mb-2 flex min-h-11 items-center justify-center sm:mb-4">
        {jumps.previous !== null && (
          <div className="absolute left-0">
            <ControlButton key="previous-section" aria-label="Previous section" icon={<ArrowLeft aria-hidden="true" size={18} />} onClick={() => openSection(jumps.previous)}>
              <span className="hidden sm:inline">Previous section</span>
            </ControlButton>
          </div>
        )}
        <Heading variant="group" placement="px-16 sm:px-44">
          {sectionTitle(position, sections)}
        </Heading>
        {jumps.next !== null && (
          <div className="absolute right-0">
            <ControlButton key="next-section" aria-label="Next section" icon={<ArrowRight aria-hidden="true" size={18} />} onClick={() => openSection(jumps.next)} iconEnd>
              <span className="hidden sm:inline">Next section</span>
            </ControlButton>
          </div>
        )}
      </div>
      <Heading variant="chapter" placement="mb-4" ref={questionHeading}>
        Question {position ? position.number : index + 1} of {position ? position.count : round.length}
        {position && <span className="font-normal"> ({round.length} total)</span>}
      </Heading>
      {voiceNote && <p className="mb-4">{voiceNote}</p>}
      {copyNote && <p className="mb-4">{copyNote}</p>}
      {needsStart && (
        <button type="button" className="border-2 border-foreground px-4 py-2 mb-6 inline-flex items-center gap-2" onClick={start}>
          <Play aria-hidden="true" size={18} />
          Start reading aloud
        </button>
      )}
      {item.stem.split("\n\n").map((part, partIndex) => (
        <p key={partIndex} className="mb-8 text-lg">
          {partIndex === 0
            ? words(part).map((word, wordIndex) => (
                <SpokenSpan key={wordIndex} text={word} className={spokenClass(false, followKind === "question" && spoken?.part === 0 && spoken.word === wordIndex)} />
              ))
            : part}
        </p>
      ))}
      <div className="flex flex-col gap-2 mb-6">
        {item.options.map((option, optionIndex) => (
          <button key={optionIndex} type="button" className={`border-2 p-4 text-left ${picked !== null && optionIndex === item.correctIndex ? "border-green-800 bg-green-700 text-white" : picked === optionIndex ? "border-red-700 bg-red-600 text-white" : "border-foreground"}`} disabled={picked !== null} onClick={() => choose(optionIndex)}>
            {markedWords(`${optionLetter(optionIndex)}. ${option}`).map((word, wordIndex) => {
              const now = followKind === "question" && spoken?.part === optionIndex + 1 && spoken.word === wordIndex
              return (
                <SpokenSpan key={wordIndex} text={word.text} className={spokenClass(word.bold, now)} />
              )
            })}
          </button>
        ))}
      </div>
      <div className="flex items-center justify-between gap-4 mb-6">
        <ControlButton disabled={index === 0} onClick={() => goTo(index - 1)} aria-label="Back" icon={<ArrowLeft aria-hidden="true" size={18} />}>
          <span className="hidden sm:inline">Back</span>
        </ControlButton>
        <div className="flex items-center gap-4">
          <ControlButton onClick={() => speakQuestion(item)} aria-label="Read again" icon={<Repeat aria-hidden="true" size={18} />}>
            <span className="hidden sm:inline">Read again</span>
          </ControlButton>
          <ControlButton onClick={() => stopSpeaking()} aria-label="Stop" icon={<Square aria-hidden="true" size={18} />}>
            <span className="hidden sm:inline">Stop</span>
          </ControlButton>
        </div>
        <ControlButton
          aria-expanded={hintOpen}
          aria-label="Hint"
          icon={<CircleHelp aria-hidden="true" size={18} />}
          onClick={() => {
            const open = !hintOpen
            setHintOpen(open)
            if (open) speak(item.constraint)
            else stopSpeaking()
          }}
        >
          <span className="hidden sm:inline">Hint</span>
        </ControlButton>
        <ControlButton disabled={index >= round.length - 1} onClick={() => goTo(index + 1)} aria-label="Next" icon={<ArrowRight aria-hidden="true" size={18} />} iconEnd>
          <span className="hidden sm:inline">Next</span>
        </ControlButton>
      </div>
      {hintOpen && <p className="mb-6 text-lg">{item.constraint}</p>}
      <p ref={explanationRef} role="status" aria-live="polite" className={picked === null ? "sr-only" : "mb-4 font-bold"}>
        {picked === null || picked === item.correctIndex
          ? (picked === null ? "" : answerAloud(true, (item.options[item.correctIndex] ?? "").replace(/\*\*/g, "")))
          : words(explanationShown(item)[0] ?? "").map((word, wordIndex) => {
              // The same words the voice says, so each one is marked as it is spoken.
              const said = followKind === "explanation" && spoken?.part === 0 && spoken.word === wordIndex
              return <SpokenSpan key={wordIndex} text={word} className={spokenClass(true, said)} />
            })}
      </p>
      {picked !== null && picked !== item.correctIndex && (
        <div className="border-2 border-foreground p-4 mb-6 text-lg">
          <p className="mb-3">
            <span className={spokenClass(true, followKind === "explanation" && spoken?.part === 1)}>Why <Names text={item.options[item.correctIndex] ?? ""} />: </span>
            {markedWords(item.why).map((word, wordIndex) => (
              <SpokenSpan key={wordIndex} text={word.text} className={spokenClass(word.bold, followKind === "explanation" && spoken?.part === 2 && spoken.word === wordIndex)} />
            ))}
          </p>
          <p className="mb-3">
            {words("Binding constraint: ").map((word, wordIndex) => (
              <SpokenSpan key={wordIndex} text={word} className={spokenClass(true, followKind === "explanation" && spoken?.part === 3 && spoken.word === wordIndex)} />
            ))}
            {words(item.constraint).map((word, wordIndex) => (
              <SpokenSpan key={wordIndex} text={word} className={spokenClass(false, followKind === "explanation" && spoken?.part === 4 && spoken.word === wordIndex)} />
            ))}
          </p>
          <p className="text-base text-muted-foreground">
            Source: {/^https?:\/\//.test(item.source) ? <a href={item.source} target="_blank" rel="noopener noreferrer">{item.whySource}</a> : item.whySource}
          </p>
        </div>
      )}
      {picked !== null && (
        <div className="flex flex-wrap gap-4">
          <button type="button" className="border-2 border-foreground px-4 py-2" onClick={() => void discuss()}>Discuss</button>
        </div>
      )}
      {unsaved > 0 && <p role="alert" className="mt-6 font-bold">{unsaved === 1 ? "1 answer was" : `${unsaved} answers were`} not saved. This device could not keep it and the Mac could not be reached.</p>}
      {waiting > 0 && <p role="status" className="mt-6">{waiting === 1 ? "1 answer is" : `${waiting} answers are`} kept on this device until the Mac can be reached.</p>}
      <p className="text-muted-foreground mt-auto pt-4">
        Synced with official docs: {namesChecked ?? "never"}
      </p>
    </div>
  )
}
