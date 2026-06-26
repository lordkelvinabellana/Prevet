import { test, expect } from "@playwright/test";
import { hasCreds, login, fillAssessForm } from "./helpers";

test.describe("UI: theme + responsive form", () => {
  test.skip(
    !hasCreds,
    "Set E2E_EMAIL and E2E_PASSWORD (a real Supabase user) to run authenticated E2E.",
  );

  test("dark mode toggles and persists across reload", async ({ page }) => {
    await login(page);
    const isDark = () =>
      page.evaluate(() => document.documentElement.classList.contains("dark"));

    const before = await isDark();
    await page.getByRole("button", { name: "Toggle dark mode" }).click();
    const after = await isDark();
    expect(after).toBe(!before);

    await page.reload();
    expect(await isDark()).toBe(after);
  });

  test("assess form stacks to a single column on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await login(page);
    await page.goto("/assess");

    const plate = await page.getByLabel("Plate").boundingBox();
    const vin = await page.getByLabel("VIN").boundingBox();
    // On mobile the two identity fields stack rather than sit side by side.
    expect(plate).not.toBeNull();
    expect(vin).not.toBeNull();
    expect(vin!.y).toBeGreaterThan(plate!.y + 10);
  });

  test("an invalid field shows an inline error on blur", async ({ page }) => {
    await login(page);
    await page.goto("/assess");
    const make = page.getByLabel("Make");
    await make.click();
    await make.blur();
    await expect(page.getByText("Make is required")).toBeVisible();
  });

  test("a non-existent assessment shows the not-found page", async ({
    page,
  }) => {
    await login(page);
    await page.goto("/assessments/00000000-0000-0000-0000-000000000000");
    await expect(page.getByText("Not found")).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Back to assessments/i }),
    ).toBeVisible();
  });

  test("records a purchase and surfaces savings + 'Bought' in the list", async ({
    page,
  }) => {
    await login(page);
    // Seed a priced-to-buy assessment (asking $25,000) and open it.
    await fillAssessForm(page, { plate: "1ABC123", asking: 25000 });
    await expect(page.getByText("Buy", { exact: true })).toBeVisible();
    await page
      .getByRole("link", { name: /Open & record purchase/i })
      .click();
    await page.waitForURL(/\/assessments\/[0-9a-f-]{36}/);

    // Record a purchase below asking, via the popup.
    await page.getByRole("button", { name: "Record purchase" }).click();
    await page.getByLabel("Purchase price").fill("22000");
    await page.getByRole("button", { name: "Save purchase" }).click();
    await expect(page.getByText(/Bought \$22,000/)).toBeVisible();
    await expect(page.getByText(/saved .* vs asking/i)).toBeVisible();

    // The list surfaces the purchase.
    await page.goto("/assessments");
    await expect(page.getByText(/Bought \$22,000/).first()).toBeVisible();
  });

  test("on mobile, /assess is a two-step form → result flow", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page);
    await page.goto("/assess");

    // Step 1 — the form is the screen.
    await expect(page.getByLabel("Plate")).toBeVisible();

    // Fill + submit → step 2: result shows, the form is hidden.
    await fillAssessForm(page, { plate: "1ABC123", asking: 25000 });
    await expect(page.getByText("Buy", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Plate")).toBeHidden();

    // "Edit details" returns to the form with values intact (no data loss).
    await page.getByRole("button", { name: /Edit details/ }).click();
    await expect(page.getByLabel("Plate")).toBeVisible();
    await expect(page.getByLabel("Seller asking")).toHaveValue("25000");
  });

  test("dashboard shows metrics and CSV export downloads", async ({ page }) => {
    await login(page);
    // Seed at least one assessment so there's data.
    await fillAssessForm(page, { plate: "1ABC123", asking: 25000 });
    await expect(page.getByText("Buy", { exact: true })).toBeVisible();

    await page.goto("/dashboard");
    await expect(
      page.getByRole("heading", { name: "Dashboard" }),
    ).toBeVisible();
    await expect(page.getByText("Verdicts")).toBeVisible();
    await expect(page.getByText("Saved vs asking")).toBeVisible();

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("link", { name: "Export CSV" }).click(),
    ]);
    expect(download.suggestedFilename()).toBe("assessments.csv");
  });
});
