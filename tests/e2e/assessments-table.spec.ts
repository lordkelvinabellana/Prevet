import { test, expect } from "@playwright/test";
import { hasCreds, login } from "./helpers";

test.describe("assessments table dashboard", () => {
  test.skip(
    !hasCreds,
    "Set E2E_EMAIL and E2E_PASSWORD (a real Supabase user) to run authenticated E2E.",
  );

  test.beforeEach(async ({ page }) => {
    await login(page);
    // Seed a Buy and a Pass so the table has rows to work with.
    await page.goto("/assess");
    await page.getByRole("button", { name: "Priced to buy" }).click();
    await expect(page.getByText("Buy", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Overpriced" }).click();
    await expect(page.getByText("Pass", { exact: true })).toBeVisible();
  });

  test("shows stats + table, and search filters / clears", async ({ page }) => {
    await page.goto("/assessments");

    // Summary + at least one seeded row.
    await expect(page.getByText("Total", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Toyota Corolla/ }).first(),
    ).toBeVisible();

    // Search narrows; a non-match shows the empty state; clearing restores.
    const search = page.getByLabel("Search assessments");
    await search.fill("zzzznomatch");
    await expect(page.getByText("No matches")).toBeVisible();
    await search.fill("");
    await expect(
      page.getByRole("link", { name: /Toyota Corolla/ }).first(),
    ).toBeVisible();
  });

  test("verdict filter and sort update the URL", async ({ page }) => {
    await page.goto("/assessments");

    await page.getByRole("button", { name: "Pass" }).click();
    await expect(page).toHaveURL(/verdict=pass/);

    await page.getByRole("link", { name: /Max offer/ }).click();
    await expect(page).toHaveURL(/sort=max_offer/);
  });

  test("a row opens the detail page", async ({ page }) => {
    await page.goto("/assessments");
    await page.getByRole("link", { name: /Toyota Corolla/ }).first().click();
    await expect(page).toHaveURL(/\/assessments\/[0-9a-f-]{36}$/);
    await expect(
      page.getByRole("heading", { name: /Toyota Corolla/ }),
    ).toBeVisible();
  });

  test("collapses to cards on a narrow viewport", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto("/assessments");
    // The desktop table is hidden; the card list link is still reachable.
    await expect(page.locator("table")).toBeHidden();
    await expect(
      page.getByRole("link", { name: /Toyota Corolla/ }).first(),
    ).toBeVisible();
  });
});
