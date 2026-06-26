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

/**
 * A unique, trigger-token-free VIN per call. Uses only hex chars (0-9A-F) so it
 * can never accidentally contain a scenario token (STOLEN/WOVR/FINANCE/…). Keeps
 * E2E runs idempotent under the duplicate-VIN guard — every created car is new,
 * so the suite never collides with rows from a previous run (no DB wipe needed).
 */
export function uniqueVin(): string {
  const hex = (
    Date.now().toString(16) + Math.floor(Math.random() * 0xfffff).toString(16)
  ).toUpperCase();
  return `E2E${hex}`.slice(0, 17);
}

/**
 * Fill and submit the assess form for the shared demo spec (2018 Corolla Ascent
 * Sport, 90,000 km, $500 repairs — max offer $27,952.50), so `asking` picks the
 * verdict: ≤ ~27,952 → Buy, ~27,953–29,423 → Check, higher → Pass. A `plate`
 * carrying a token (FINANCE-… / STOLEN-…) drives the history path. Returns the
 * VIN used. Navigates to /assess itself.
 */
export async function fillAssessForm(
  page: Page,
  opts: { asking: number; plate?: string; vin?: string; repairs?: number },
): Promise<string> {
  const vin = opts.vin ?? uniqueVin();
  await page.goto("/assess");
  if (opts.plate) await page.getByLabel("Plate").fill(opts.plate);
  await page.getByLabel("VIN").fill(vin);
  await page.getByLabel("Make").fill("Toyota");
  await page.getByLabel("Model").fill("Corolla");
  await page.getByLabel("Year").fill("2018");
  await page.getByLabel("Kilometres").fill("90000");
  await page.getByLabel("Trim").fill("Ascent Sport");
  await page.getByLabel("Seller asking").fill(String(opts.asking));
  await page.getByLabel("Est. repairs").fill(String(opts.repairs ?? 500));
  await page.getByRole("button", { name: "Get verdict" }).click();
  return vin;
}
