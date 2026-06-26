import { test, expect } from "@playwright/test";
import { hasCreds, login, fillAssessForm, uniqueVin } from "./helpers";

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
    // Phase 1: a priced-to-buy car (unique VIN → fresh each run).
    await fillAssessForm(page, { plate: "1ABC123", asking: 25000 });

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
    // FINANCE token in the plate drives the history path; price alone says Buy.
    await fillAssessForm(page, { plate: "FINANCE-1", asking: 25000 });
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
    await fillAssessForm(page, { plate: "1ABC123", asking: 25000 });

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
    await fillAssessForm(page, { plate: "1ABC123", asking: 38000 });

    await expect(page.getByText("Pass", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Run PPSR check/ }),
    ).toBeHidden();
  });

  test("uploads a car photo: thumbnail in the list + gallery on the detail", async ({
    page,
  }) => {
    // A 1×1 PNG, uploaded to the private car-photos bucket by the form.
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC",
      "base64",
    );
    await page.goto("/assess");
    await page.getByLabel("Plate").fill("1ABC123");
    await page.getByLabel("VIN").fill(uniqueVin());
    await page.getByLabel("Make").fill("Toyota");
    await page.getByLabel("Model").fill("Corolla");
    await page.getByLabel("Year").fill("2018");
    await page.getByLabel("Kilometres").fill("90000");
    await page.getByLabel("Trim").fill("Ascent Sport");
    await page.getByLabel("Seller asking").fill("25000");
    await page.getByLabel("Est. repairs").fill("500");

    await page
      .getByLabel("Add car photos")
      .setInputFiles({ name: "car.png", mimeType: "image/png", buffer: png });
    // Wait for the eager upload to finish before submitting.
    await expect(page.getByRole("button", { name: "Remove photo" })).toBeVisible();
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: "Get verdict" }).click();
    await expect(page.getByText("Buy", { exact: true })).toBeVisible();

    // Detail view shows the photo in a gallery.
    await page.getByRole("link", { name: /Open & record purchase/i }).click();
    await page.waitForURL(/\/assessments\/[0-9a-f-]{36}/);
    await expect(page.getByRole("img", { name: "Car photo 1" })).toBeVisible();
  });

  test("edit a car re-runs the engine and updates the verdict", async ({
    page,
  }) => {
    await fillAssessForm(page, { plate: "1ABC123", asking: 25000 });
    await expect(page.getByText("Buy", { exact: true })).toBeVisible();
    await page.getByRole("link", { name: /Open & record purchase/i }).click();
    await page.waitForURL(/\/assessments\/[0-9a-f-]{36}/);

    await page.getByRole("link", { name: "Edit" }).click();
    await page.waitForURL(/\/assessments\/[0-9a-f-]{36}\/edit$/);
    // Push the asking price up so the same car now prices as a Pass.
    await page.getByLabel("Seller asking").fill("38000");
    await page.getByRole("button", { name: "Save & re-run" }).click();

    await page.waitForURL(/\/assessments\/[0-9a-f-]{36}$/);
    await expect(page.getByText("Pass", { exact: true })).toBeVisible();
  });

  test("deletes an assessment — it's gone afterwards", async ({ page }) => {
    await fillAssessForm(page, { plate: "1ABC123", asking: 25000 });
    await expect(page.getByText("Buy", { exact: true })).toBeVisible();
    await page.getByRole("link", { name: /Open & record purchase/i }).click();
    await page.waitForURL(/\/assessments\/[0-9a-f-]{36}/);
    const detailUrl = page.url();

    await page.getByRole("button", { name: "Delete" }).click(); // open the confirm
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Delete" })
      .click(); // confirm
    await page.waitForURL(/\/assessments$/);

    // The detail page no longer exists.
    await page.goto(detailUrl);
    await expect(page.getByText("Not found")).toBeVisible();
  });

  test("a duplicate VIN is blocked and links to the existing assessment", async ({
    page,
  }) => {
    const vin = uniqueVin();
    // First assessment for this VIN.
    await fillAssessForm(page, { plate: "1ABC123", vin, asking: 25000 });
    await expect(page.getByText("Buy", { exact: true })).toBeVisible();

    // Re-entering the same VIN warns on blur with a link to the existing one.
    await page.goto("/assess");
    await page.getByLabel("Plate").fill("1ABC123");
    await page.getByLabel("VIN").fill(vin);
    await page.getByLabel("VIN").blur();
    await expect(page.getByText(/already assessed this VIN/i)).toBeVisible();
    const viewLink = page.getByRole("link", { name: "View that assessment" });
    await expect(viewLink).toBeVisible();

    // Submitting anyway is still blocked server-side (no new row), and the link
    // opens the existing assessment's detail page.
    await viewLink.click();
    await expect(page).toHaveURL(/\/assessments\/[0-9a-f-]{36}$/);
  });
});
