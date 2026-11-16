// The log the capture commands share. A command starts it once with its name; every module then writes to it through `log` and `debug`,
// so the browser code and the command write to the same file. See quiz/lib/debug-log.ts for the format.
import { createDebugLog, logFileFor, type DebugLog, type LogDetail } from "../lib/debug-log.ts"
import { privateReadingRoot } from "../lib/private-reading.ts"

let current: DebugLog = createDebugLog({ file: null, verbose: false })

// Starts this run's log file beside the private store. Verbose adds the detail a person debugging a run wants.
export function startLog(name: string, verbose: boolean): DebugLog {
  let file: string | null = null
  try {
    file = logFileFor(privateReadingRoot(), name, new Date())
  } catch {
    // The private folder is not usable: the run goes on without a log, and its own error says why.
    file = null
  }
  current = createDebugLog({ file, verbose })
  return current
}

export function log(event: string, detail?: LogDetail): void {
  current.log(event, detail)
}

export function debug(event: string, detail?: LogDetail): void {
  current.debug(event, detail)
}

export function logPath(): string | null {
  return current.path
}
