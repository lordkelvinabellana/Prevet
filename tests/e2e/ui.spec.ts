import { test, expect } from "@playwright/test";
import { hasCreds, login } from "./helpers";

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
    await page.goto("/assess");
    await page.getByRole("button", { name: "Priced to buy" }).click();
    await expect(page.getByText("Buy", { exact: true })).toBeVisible();
    await page
      .getByRole("link", { name: /Open & record purchase/i })
      .click();
    await page.waitForURL(/\/assessments\/[0-9a-f-]{36}/);

    // Record a purchase below asking.
    await page.getByLabel("Purchase price").fill("22000");
    await page.getByRole("button", { name: "Record purchase" }).click();
    await expect(page.getByText(/Purchased for/i)).toBeVisible();
    await expect(page.getByText(/Saved .* vs asking/i)).toBeVisible();

    // The list surfaces the purchase.
    await page.goto("/assessments");
    await expect(page.getByText(/Bought \$22,000/).first()).toBeVisible();
  });
});
