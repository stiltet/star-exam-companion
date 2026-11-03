// Which stored voice clips an exam may delete. The clips live in one cache shared by every exam on the device, so a
// clip goes only when this exam stored it and no exam's list holds it any more. A clip stored before the lists
// existed is in no list, so it is never deleted.
export type VoiceLists = Record<string, string[]>

export function voiceCleanup(cached: string[], lists: VoiceLists, exam: string, wanted: string[]): { lists: VoiceLists; remove: string[] } {
  const previous = new Set(lists[exam] ?? [])
  const next: VoiceLists = { ...lists, [exam]: wanted }
  const stillUsed = new Set(Object.values(next).flat())
  return { lists: next, remove: cached.filter((clip) => previous.has(clip) && !stillUsed.has(clip)) }
}
