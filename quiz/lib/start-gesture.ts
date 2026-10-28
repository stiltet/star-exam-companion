// After a reload iOS refuses sound until a user gesture, so the voice quiz starts reading on the
// next touch anywhere on the page. A touch on a control is left to that control: the Start button
// starts the reading itself, and an answer only answers, so nothing runs twice.

/** What a page-wide listener sees of an event: its type, the key pressed, and whether it hit a control. */
export interface Gesture {
  type: string
  key?: string
  onControl: boolean
}

/** Elements that handle a tap themselves. */
export const CONTROLS = "a, button, input, select, textarea, label, summary, [role='button']"

/** True when this gesture should start the reading. Tab, Shift and other keys only move or modify. */
export function startsReading({ type, key, onControl }: Gesture): boolean {
  if (onControl) return false
  if (type === "keydown") return key === "Enter" || key === " "
  return type === "touchend" || type === "click"
}
