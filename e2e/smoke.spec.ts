import { expect, test } from "@playwright/test";

test("storefront and protected admin routes render", async ({ page }) => {
  await page.goto("./");
  await expect(page.locator("#root")).not.toBeEmpty();
  await page.goto("./admin");
  await expect(page.getByText(/Staff sign in|Checking your access|Supabase is not configured/).first()).toBeVisible();
});
