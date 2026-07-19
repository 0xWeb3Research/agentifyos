import { defineConfig, devices } from "@playwright/test";

// The dev server is already running at http://localhost:8402 (see CONTRACTS.md),
// so we deliberately do NOT configure a `webServer` here.
export default defineConfig({
  testDir: "e2e",
  timeout: 30000,
  expect: { timeout: 10000 },
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL: "http://localhost:8402",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
