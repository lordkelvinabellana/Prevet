import { type Page } from "@playwright/test";

/**
 * Authenticated E2E needs a real Supabase user (auth is not mocked). Provide
 * credentials via env and the auth specs run; otherwise they self-skip.
 *
 *   E2E_EMAIL=you@example.com E2E_PASSWORD=secret npm run test:e2e
 */
export const E2E_EMAIL = process.env.E2E_EMAIL;
export const E2E_PASSWORD = process.env.E2E_PASSWORD;
export const hasCreds = Boolean(E2E_EMAIL && E2E_PASSWORD);

/** Sign in through the real login form and wait for the redirect home. */
export async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(E2E_EMAIL as string);
  await page.getByLabel("Password").fill(E2E_PASSWORD as string);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("http://localhost:3000/");
}
