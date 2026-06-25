import { test, expect } from "@playwright/test";

/** No credentials needed — runs everywhere. */
test("unauthenticated visit to a protected route redirects to /login", async ({
  page,
}) => {
  await page.goto("/assess");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});
