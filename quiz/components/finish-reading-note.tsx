import { Text } from "@/components/atoms/text"

// Under the Unfinished notice: the one thing to do to finish. The steps, the first-time sign-in and the options for any AI tool
// are in skills/capture-reading/SKILL.md, not here, so this never fills a phone screen.
export function FinishReadingNote() {
  return (
    <div className="mb-6 space-y-1" data-testid="finish-reading">
      <Text variant="strong">To finish, run in the project folder:</Text>
      <Text variant="muted">pnpm --dir quiz reading:crawl</Text>
    </div>
  )
}
