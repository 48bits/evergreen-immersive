import { defineConfig } from "@playwright/test";
import { launchOptions } from "./scripts/browser.mjs";

export default defineConfig({
  testDir: "./tests",
  timeout: 30000,
  expect: { timeout: 8000 },
  workers: 1,
  use: {
    baseURL: "http://localhost:4173",
    viewport: { width: 1440, height: 1000 },
    launchOptions,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  reporter: [["list"], ["json", { outputFile: "artifacts/test-report.json" }]],
  webServer: {
    command: "npm run preview -- --port 4173",
    url: "http://localhost:4173",
    reuseExistingServer: true,
  },
});
