import { defineConfig } from "@playwright/test"
import { E2E_WORKERS, e2eBasePort, e2ePortFor } from "./e2e/server-env.mjs"

const port = e2eBasePort()
if (!Number.isInteger(port) || port < 1024 || port + E2E_WORKERS - 1 > 65535 || port === 3000 || (port < 3000 && port + E2E_WORKERS - 1 >= 3000)) {
  throw new Error("QUIZ_E2E_PORT must be an unprivileged port other than the normal quiz port 3000, and so must the next port, which the second worker's server uses")
}

const WEBKIT_SPECS = ["**/offline.spec.ts", "**/offline-unreachable.spec.ts", "**/back-*.spec.ts", "**/about-webkit.spec.ts", "**/resume-webkit.spec.ts"]

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  // One server for each worker (see e2e/server-env.mjs): the tests share no server state, so the files can run side by side.
  workers: E2E_WORKERS,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  retries: 0,
  forbidOnly: Boolean(process.env.CI),
  // The json report is what the Pre-push checks read to refuse a slow test; it is written beside the unit test report.
  reporter: [["list"], ["json", { outputFile: "../temp/gate/browser.json" }]],
  use: {
    baseURL: `http://localhost:${port}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  // Two projects: Chromium for the pages, WebKit (iPhone Safari's engine) only for what differs there,
  // the offline worker, the installed app's Back button, its launch on the last page and the About page's list role. 375 px is the lowest phone width, and the only one tested.
  projects: [
    { name: "chromium-375", testIgnore: WEBKIT_SPECS, use: { browserName: "chromium", viewport: { width: 375, height: 844 } } },
    { name: "webkit-375", testMatch: WEBKIT_SPECS, use: { browserName: "webkit", viewport: { width: 375, height: 844 } } },
  ],
  webServer: Array.from({ length: E2E_WORKERS }, (_, index) => ({
    command: "node e2e/server.mjs",
    wait: { stdout: /Ready in/ },
    timeout: 300_000,
    reuseExistingServer: false,
    // The first server builds the app; the others start from its build once it is listening. The first is given an empty QUIZ_E2E_BUILD_PORT
    // so that one set in the shell is not inherited, which would make it skip the build and serve an old one.
    env: { QUIZ_E2E_PORT: String(e2ePortFor(port, index)), QUIZ_NIGHT_PRELOAD: "1", QUIZ_E2E_BUILD_PORT: index > 0 ? String(port) : "" },
  })),
})
