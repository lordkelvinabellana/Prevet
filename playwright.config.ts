import { defineConfig, devices } from "@playwright/test";

const baseURL = "http://localhost:3000";

/**
 * E2E config. Specs live in tests/e2e (Vitest is configured to ignore them).
 * The dev server is started automatically and reused if one is already running.
 * Authenticated specs need E2E_EMAIL / E2E_PASSWORD for a real Supabase user;
 * they self-skip when those aren't set (see tests/e2e/helpers.ts).
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
