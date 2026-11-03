import { defineConfig } from "@playwright/test"

const port = Number(process.env.QUIZ_E2E_PORT ?? 47822)
if (!Number.isInteger(port) || port < 1024 || port > 65535 || port === 3000) {
  throw new Error("QUIZ_E2E_PORT must be an unprivileged port other than the normal quiz port 3000")
}

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
  projects: (["chromium", "webkit"] as const).flatMap((browserName) =>
    [375, 390].map((width) => ({
      name: `${browserName}-${width}`,
      use: {
        browserName,
        viewport: { width, height: 844 },
      },
    })),
  ),
  webServer: {
    command: "node e2e/server.mjs",
    wait: { stdout: /Ready in/ },
    timeout: 300_000,
    reuseExistingServer: false,
    env: { QUIZ_E2E_PORT: String(port), QUIZ_NIGHT_PRELOAD: "0" },
  },
})
