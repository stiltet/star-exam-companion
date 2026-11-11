import { appendFileSync, mkdirSync } from "node:fs"
import path from "node:path"

// A small log for the capture commands: one line per event, `time  event  key=value ...`, so a run that went wrong can be read
// afterwards. It is written beside the private store, outside the repository. Values are short and primitive, addresses are written
// without their numbers, and the callers never pass lesson text. A log with no file does nothing, and a log that cannot be written
// never breaks the run.

export type LogValue = string | number | boolean | null | undefined
export type LogDetail = Record<string, LogValue>

export const MAX_VALUE_CHARS = 300

// An address without the numbers in it, so no course, lesson or session id is kept.
export function maskAddress(address: string): string {
  try {
    const url = new URL(address)
    return `${url.host}${url.pathname.replace(/\d+/g, "N")}`
  } catch {
    return address.replace(/\d+/g, "N").slice(0, MAX_VALUE_CHARS)
  }
}

// The first line of an error's message, cut short: what failed, without a stack or a page's text.
export function describeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  return (message.split("\n")[0] ?? "").slice(0, MAX_VALUE_CHARS)
}

function render(value: LogValue): string {
  const text = value === null || value === undefined ? "" : String(value)
  const clipped = text.length > MAX_VALUE_CHARS ? `${text.slice(0, MAX_VALUE_CHARS)}…` : text
  return clipped === "" || /[\s"=]/.test(clipped) ? JSON.stringify(clipped) : clipped
}

// The line for one event. The keys are written in the order given.
export function formatLine(time: Date, event: string, detail: LogDetail = {}): string {
  const pairs = Object.entries(detail).map(([key, value]) => `${key}=${render(value)}`)
  return [time.toISOString(), event, ...pairs].join("  ") + "\n"
}

// The file a run writes: a logs folder beside the private store, one file per run.
export function logFileFor(privateRoot: string, name: string, now: Date): string {
  const stamp = now.toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15)
  return path.join(path.dirname(privateRoot), "logs", `${name}-${stamp}.log`)
}

export type DebugLog = {
  // The file being written, or null when the log writes nothing.
  path: string | null
  verbose: boolean
  // An event worth keeping in every run.
  log: (event: string, detail?: LogDetail) => void
  // An event only a verbose run keeps.
  debug: (event: string, detail?: LogDetail) => void
}

export function createDebugLog(options: { file: string | null; verbose: boolean; now?: () => Date }): DebugLog {
  const now = options.now ?? (() => new Date())
  let usable = options.file !== null
  if (options.file !== null) {
    try {
      mkdirSync(path.dirname(options.file), { recursive: true, mode: 0o700 })
    } catch {
      usable = false
    }
  }
  const write = (event: string, detail?: LogDetail): void => {
    if (!usable || options.file === null) return
    try {
      appendFileSync(options.file, formatLine(now(), event, detail), { mode: 0o600 })
    } catch {
      usable = false
    }
  }
  return {
    path: options.file,
    verbose: options.verbose,
    log: write,
    debug: (event, detail) => {
      if (options.verbose) write(event, detail)
    },
  }
}
