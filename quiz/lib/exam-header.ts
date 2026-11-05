import { currentExam } from "./scope.ts"

// Every request that reads or changes an exam's data says which exam its page belongs to, so a page left
// open on one exam never reads or writes another's after the Mac is switched. Client-safe.
export const EXAM_HEADER = "X-Quiz-Exam"

export function examHeaders(): Record<string, string> {
  return { [EXAM_HEADER]: currentExam() }
}

const RELOADED_KEY = "quiz-exam-reloaded"
const RELOAD_GAP_MS = 15_000
const WORKER_ACK_MS = 2_000
const WORKER_UPDATE_MS = 15_000
export const EXAM_REFRESH_FAILED = "quiz-exam-refresh-failed"

let refreshFailed = false
let resuming: Promise<boolean> | null = null

export function examRefreshFailed(): boolean {
  return refreshFailed
}

function showRefreshFailure(): void {
  refreshFailed = true
  window.dispatchEvent(new Event(EXAM_REFRESH_FAILED))
}

async function tellWorker(worker: ServiceWorker): Promise<boolean> {
  if (typeof MessageChannel === "undefined") return false
  let channel: MessageChannel
  try {
    channel = new MessageChannel()
  } catch {
    return false
  }
  return new Promise<boolean>((resolve) => {
    let done = false
    const finish = (ready: boolean) => {
      if (done) return
      done = true
      window.clearTimeout(timer)
      channel.port1.close()
      resolve(ready)
    }
    const timer = window.setTimeout(() => finish(false), WORKER_ACK_MS)
    channel.port1.onmessage = (event: MessageEvent<unknown>) => finish(event.data === "ready")
    channel.port1.onmessageerror = () => finish(false)
    try {
      worker.postMessage("quiz-mac-reachable", [channel.port2])
    } catch {
      channel.port2.close()
      finish(false)
    }
  })
}

// An older worker does not recognise the message. Ask for the new worker and wait for it to
// take control; until then a reload can still return the old exam from the offline cache.
async function updatedController(container: ServiceWorkerContainer, previous: ServiceWorker): Promise<ServiceWorker | null> {
  return new Promise((resolve) => {
    let done = false
    const finish = (worker: ServiceWorker | null) => {
      if (done) return
      done = true
      window.clearTimeout(timer)
      container.removeEventListener("controllerchange", check)
      resolve(worker)
    }
    const check = () => {
      const current = container.controller
      if (current && current !== previous) finish(current)
    }
    const timer = window.setTimeout(() => finish(null), WORKER_UPDATE_MS)
    container.addEventListener("controllerchange", check)
    check()
    if (done) return
    let registration: Promise<ServiceWorkerRegistration | undefined>
    try {
      registration = container.getRegistration()
    } catch {
      finish(null)
      return
    }
    void registration.then((registration) => {
      if (!registration) return finish(null)
      return registration.update().then(() => {
        check()
        if (!registration.installing && !registration.waiting && registration.active === previous) finish(null)
      })
    }).catch(() => finish(null))
  })
}

// A successful API response proves the Mac is reachable. Wait for the worker to stop using its
// offline backoff before loading a page, or it can return the previous exam's cached HTML.
export function resumePageFetches(): Promise<boolean> {
  if (!resuming) {
    resuming = (async () => {
      const container = typeof navigator === "undefined" ? undefined : navigator.serviceWorker
      const initial = container?.controller
      if (!initial || !container) return true
      let worker: ServiceWorker = initial
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const ready = await tellWorker(worker)
        const current = container.controller
        if (ready && current === worker) return true
        if (!current) return false
        const updated: ServiceWorker | null = current !== worker ? current : await updatedController(container, worker)
        if (!updated) return false
        worker = updated
      }
      return false
    })().finally(() => { resuming = null })
  }
  return resuming
}

// The Mac refused a request because it now serves another exam. The page is stale, so it reloads once to
// show the exam served; what it queued stays on the device under its own exam. Returns true when it was
// such a refusal. Never reloads twice within a few seconds, whatever the Mac says.
export async function followWrongExam(response: Response): Promise<boolean> {
  if (response.status !== 409) return false
  let served: unknown
  try {
    served = ((await response.clone().json()) as { wrongExam?: unknown }).wrongExam
  } catch {
    // Not a wrong-exam answer: another 409 (a glossary row that cannot be read) is handled by its caller.
    return false
  }
  if (typeof served !== "string") return false
  if (served === currentExam() || typeof window === "undefined") return true
  try {
    const saved = Number(window.sessionStorage.getItem(RELOADED_KEY) ?? 0)
    const last = Number.isFinite(saved) ? saved : 0
    if (Date.now() - last <= RELOAD_GAP_MS) return true
    window.sessionStorage.setItem(RELOADED_KEY, String(Date.now()))
  } catch {
    showRefreshFailure()
    return true
  }
  if (await resumePageFetches()) {
    window.location.reload()
  } else {
    try {
      window.sessionStorage.removeItem(RELOADED_KEY)
    } catch {
      // The visible warning still lets the person retry.
    }
    showRefreshFailure()
  }
  return true
}
