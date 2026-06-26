import { test, expect } from "@playwright/test";
import { hasCreds } from "./helpers";

test.describe("self-service sign-up", () => {
  test.skip(
    !hasCreds,
    "Set E2E_EMAIL and E2E_PASSWORD to run the live (Supabase-backed) E2E.",
  );

  test("create-account flow creates the account (confirm-email notice)", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByRole("link", { name: "Create an account" }).click();
    await page.waitForURL(/\/signup$/);

    const email = `e2e-signup-${Date.now()}@stakra.co`;
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password", { exact: true }).fill("Test1234!");
    await page.getByLabel("Confirm password").fill("Test1234!");
    await page.getByRole("button", { name: "Create account" }).click();

    // This project has email confirmation on → a notice, not an auto sign-in.
    await expect(page.getByText(/check your email/i)).toBeVisible();
  });

  test("rejects mismatched passwords client-to-server", async ({ page }) => {
    await page.goto("/signup");
    await page.getByLabel("Email").fill("nobody@stakra.co");
    await page.getByLabel("Password", { exact: true }).fill("Test1234!");
    await page.getByLabel("Confirm password").fill("Different1!");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText(/don't match/i)).toBeVisible();
  });
});
