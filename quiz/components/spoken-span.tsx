import { spokenPieces } from "@/lib/spoken-word"

// One word of text being read. The look comes from spokenClass or the same classes in Read
// aloud. An underline stops at the word; the space after it stays outside that line.
export function SpokenSpan({ text, className, wordIndex }: { text: string; className?: string; wordIndex?: number }) {
  const pieces = spokenPieces(text, className)
  const marked = wordIndex === undefined ? undefined : wordIndex
  const only = pieces[0]
  if (pieces.length === 1 && only) {
    return (
      <span data-word={marked} className={only.className}>
        {only.text}
      </span>
    )
  }
  return (
    <span data-word={marked}>
      {pieces.map((piece, index) => (
        <span key={index} className={piece.className}>
          {piece.text}
        </span>
      ))}
    </span>
  )
}
