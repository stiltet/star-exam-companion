import { Text } from "@/components/atoms/text"
import { activePack } from "@/lib/pack"
import { isMissing, type Need } from "@/lib/unfinished"

// On a feature page of an unfinished exam, the exam's own notice (homeNotice in pack.json) when that feature's data is not written yet,
// so the page says what is missing instead of showing an empty list or a button that starts nothing. A finished exam, or one with
// the data, shows nothing. The rule is in lib/unfinished.ts.
export function UnfinishedNotice({ need, placement = "mb-6" }: { need: Need; placement?: string }) {
  const pack = activePack()
  const { homeNotice } = pack.meta
  if (!homeNotice || !isMissing(need, pack)) return null
  return <Text variant="warning" role="status" placement={placement} testId="unfinished-notice">{homeNotice}</Text>
}
