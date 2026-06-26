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

    // Source data: RedBook valuation panel shows; PPSR not run yet.
    await expect(page.getByText(/Valuation ·/)).toBeVisible();
    await expect(page.getByText(/Not checked yet/i)).toBeVisible();

    // Phase 2: run PPSR. Clean car → stays Buy, history checks populate.
    await ppsr.click();
    await expect(page.getByText("Buy", { exact: true })).toBeVisible();
    await expect(page.getByText("Clear").first()).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Run PPSR check/ }),
    ).toBeHidden();

    // Saved — open it from the list and mark reviewed.
    await page.goto("/assessments");
    const row = page.getByRole("link", { name: /Toyota Corolla/ }).first();
    await expect(row).toBeVisible();
    await row.click();
    await page.getByRole("button", { name: "Mark reviewed" }).click(); // opens dialog
    await page.getByLabel("Reviewer note").fill("Looks clean, proceed.");
    await page.getByRole("button", { name: "Confirm reviewed" }).click();
    await expect(page.getByText(/Reviewed/)).toBeVisible();
    await expect(page.getByText("Looks clean, proceed.")).toBeVisible();
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
    await expect(page.getByText("Flagged").first()).toBeVisible();
  });

  test("editing after a verdict marks it stale; 'Assess another' resets the form", async ({
    page,
  }) => {
    await page.goto("/assess");
    await page.getByRole("button", { name: "Priced to buy" }).click();

    // A verdict, with the next-car action offered.
    await expect(page.getByText("Buy", { exact: true })).toBeVisible();
    const assessAnother = page.getByRole("button", { name: "Assess another" });
    await expect(assessAnother).toBeVisible();

    // Editing an input makes the shown verdict stale: a note appears and the
    // verdict's actions (which point at the old assessment) are withdrawn.
    await page.getByLabel("Seller asking").fill("30000");
    await expect(page.getByText(/Inputs changed — re-run/i)).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Open & record purchase/i }),
    ).toBeHidden();
    await expect(
      page.getByRole("button", { name: /Run PPSR check/ }),
    ).toBeHidden();

    // "Assess another" empties the form, focuses Plate, and clears the result.
    await assessAnother.click();
    await expect(page.getByLabel("Plate")).toHaveValue("");
    await expect(page.getByLabel("Plate")).toBeFocused();
    await expect(page.getByText("No verdict yet")).toBeVisible();
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
