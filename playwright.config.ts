import path from "node:path";

import { defineConfig, devices } from "@playwright/test";

import { E2E } from "./e2e/env";

// End-to-end suite against the real Express API and a dedicated *_e2e database.
// Ports differ from the dev defaults so it can run beside `npm run dev`.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL: E2E.appUrl,
    trace: "retain-on-failure",
    // Uses the installed Edge by default; set PW_CHANNEL="" to use Playwright's Chromium.
    channel: process.env.PW_CHANNEL ?? "msedge",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], channel: process.env.PW_CHANNEL ?? "msedge" } }],
  webServer: [
    {
      command: "npx tsx src/server.ts",
      cwd: path.resolve(__dirname, "../md_backend"),
      url: `${E2E.apiUrl}/health`,
      env: E2E.backendEnv,
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: `npx next dev --port ${E2E.appPort}`,
      url: `${E2E.appUrl}/login`,
      env: { API_URL: E2E.apiUrl },
      reuseExistingServer: false,
      timeout: 180_000,
    },
  ],
});
