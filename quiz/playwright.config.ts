import { defineConfig } from "@playwright/test"

const port = Number(process.env.QUIZ_E2E_PORT ?? 47822)
if (!Number.isInteger(port) || port < 1024 || port > 65535 || port === 3000) {
  throw new Error("QUIZ_E2E_PORT must be an unprivileged port other than the normal quiz port 3000")
}

const WEBKIT_SPECS = ["**/offline.spec.ts", "**/back-*.spec.ts"]

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  retries: 0,
  forbidOnly: Boolean(process.env.CI),
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${port}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  // Two projects: Chromium for the pages, WebKit (iPhone Safari's engine) only for what differs there,
  // the offline worker and the installed app's Back button. 375 px is the lowest phone width, and the only one tested.
  projects: [
    { name: "chromium-375", testIgnore: WEBKIT_SPECS, use: { browserName: "chromium", viewport: { width: 375, height: 844 } } },
    { name: "webkit-375", testMatch: WEBKIT_SPECS, use: { browserName: "webkit", viewport: { width: 375, height: 844 } } },
  ],
  webServer: {
    command: "node e2e/server.mjs",
    wait: { stdout: /Ready in/ },
    timeout: 300_000,
    reuseExistingServer: false,
    env: { QUIZ_E2E_PORT: String(port), QUIZ_NIGHT_PRELOAD: "1" },
  },
})
