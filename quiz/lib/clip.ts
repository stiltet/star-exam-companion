// One sentence's voice clip from the Mac, and what Read Aloud remembers when the Mac fails.

// How long the Mac has to make one sentence's clip before the device's own voice takes over.
export const CLIP_TIMEOUT_MS = 10_000

// Asks the Mac for a clip. A Mac that does not answer in time, or answers an error, is a plain sentence the page can show;
// the timer covers the whole answer, so a Mac that stops half way counts as silent too.
export async function fetchClip(text: string, timeoutMs: number = CLIP_TIMEOUT_MS, fetcher: typeof fetch = fetch): Promise<Blob> {
  try {
    const response = await fetcher("/api/speak/reading", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!response.ok) throw new Error(`the Mac answered ${response.status}`)
    // Inside the same try: the timer also cuts off a Mac that sends its headers and then stalls on the audio.
    return await response.blob()
  } catch (error) {
    if (error instanceof DOMException && error.name === "TimeoutError") throw new Error("the Mac did not answer in time")
    throw error
  }
}

// Once the Mac has failed, the next sentences go straight to the device voice instead of each waiting for the Mac
// again. A new Play tap forgets it, so the Mac is tried again then.
export function macGate() {
  let failure: Error | null = null
  return {
    failed(error: unknown) {
      failure = error instanceof Error ? error : new Error(String(error))
    },
    // For a request made ahead of time: its failure counts only while the reading it was made for is still the current one.
    failedIf(current: boolean, error: unknown) {
      if (current) this.failed(error)
    },
    reset() {
      failure = null
    },
    // The reason the Mac is being skipped, or null when it should be tried.
    skipped(): Error | null {
      return failure
    },
  }
}
