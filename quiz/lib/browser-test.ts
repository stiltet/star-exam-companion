import { existsSync } from "node:fs"
import test, { type TestContext } from "node:test"
import { chromium } from "@playwright/test"

// Some tests run a real command that starts Playwright's Chromium (the reading crawl and the learning-path reader). A machine without
// that browser, such as the GitHub Pages runner that runs `node --test` before it publishes the demo, or a fresh clone before
// `pnpm e2e:install`, skips them with this reason instead of failing the whole run. The Quiz gate always has the browser, so they run there.
export const browserMissing: string | false = existsSync(chromium.executablePath())
  ? false
  : "needs Playwright's Chromium, which this machine does not have: run pnpm e2e:install"

// Same call as node:test's test(name, options, fn), skipped when the browser is missing.
export function browserTest(name: string, options: { timeout: number }, fn: (t: TestContext) => Promise<void>): Promise<void> {
  return test(name, { ...options, skip: browserMissing }, fn)
}
