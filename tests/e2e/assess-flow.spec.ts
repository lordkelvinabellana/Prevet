import { test, expect } from "@playwright/test";
import { hasCreds, login } from "./helpers";

test.describe("assessment flow (two-phase: price → PPSR)", () => {
  test.skip(
    !hasCreds,
    "Set E2E_EMAIL and E2E_PASSWORD (a real Supabase user) to run authenticated E2E.",
  );

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("happy path: provisional Buy → run PPSR → finalized → saved → mark reviewed", async ({
    page,
  }) => {
    await page.goto("/assess");

    // Phase 1: quick-fill the priced-to-buy scenario (fills + runs).
    await page.getByRole("button", { name: "Priced to buy" }).click();

    // Provisional Buy with the PPSR step offered.
    await expect(page.getByText("Recommendation")).toBeVisible();
    await expect(page.getByText("Buy", { exact: true })).toBeVisible();
    const ppsr = page.getByRole("button", { name: /Run PPSR check/ });
    await expect(ppsr).toBeVisible();

    // Phase 2: run PPSR. Clean car → stays Buy, and the step is consumed.
    await ppsr.click();
    await expect(page.getByText("Buy", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Run PPSR check/ }),
    ).toBeHidden();

    // Saved — open it from the list and mark reviewed.
    await page.goto("/assessments");
    const row = page.getByRole("link", { name: /Toyota Corolla/ }).first();
    await expect(row).toBeVisible();
    await row.click();
    await page.getByRole("button", { name: "Mark reviewed" }).click();
    await expect(page.getByText(/Reviewed/)).toBeVisible();
  });

  test("PPSR flips a provisional Buy to Check when finance is owing", async ({
    page,
  }) => {
    await page.goto("/assess");
    await page.getByRole("button", { name: "Finance owing" }).click();

    // Price alone says Buy...
    await expect(page.getByText("Buy", { exact: true })).toBeVisible();

    // ...then PPSR reveals finance owing → Check.
    await page.getByRole("button", { name: /Run PPSR check/ }).click();
    await expect(page.getByText("Check", { exact: true })).toBeVisible();
    await expect(page.getByText(/Finance is owing/i)).toBeVisible();
  });

  test("a price Pass is never offered the paid PPSR check", async ({ page }) => {
    await page.goto("/assess");
    await page.getByRole("button", { name: "Overpriced" }).click();

    await expect(page.getByText("Pass", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Run PPSR check/ }),
    ).toBeHidden();
  });
});
