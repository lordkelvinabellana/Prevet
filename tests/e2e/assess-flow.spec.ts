import { test, expect } from "@playwright/test";
import { hasCreds, login } from "./helpers";

test.describe("assessment flow", () => {
  test.skip(
    !hasCreds,
    "Set E2E_EMAIL and E2E_PASSWORD (a real Supabase user) to run authenticated E2E.",
  );

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("happy path: quick-fill a Buy → verdict → saved in list → mark reviewed", async ({
    page,
  }) => {
    await page.goto("/assess");

    // One-click the "Priced to buy" scenario; it fills and runs.
    await page.getByRole("button", { name: "Priced to buy" }).click();

    // The verdict card shows a Buy with a max offer.
    await expect(page.getByText("Recommendation")).toBeVisible();
    await expect(page.getByText("Buy", { exact: true })).toBeVisible();
    await expect(page.getByText(/at or above the seller/i)).toBeVisible();

    // It was saved — find it at the top of the list and open it.
    await page.goto("/assessments");
    const row = page.getByRole("link", { name: /Toyota Corolla/ }).first();
    await expect(row).toBeVisible();
    await row.click();

    // Mark it reviewed; the panel reflects the new state.
    await page.getByRole("button", { name: "Mark reviewed" }).click();
    await expect(page.getByText(/Reviewed/)).toBeVisible();
  });

  test("finance-owing edge → Check", async ({ page }) => {
    await page.goto("/assess");
    await page.getByRole("button", { name: "Finance owing" }).click();

    await expect(page.getByText("Check", { exact: true })).toBeVisible();
    await expect(page.getByText(/Finance is owing/i)).toBeVisible();
  });
});
