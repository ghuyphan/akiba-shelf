import { expect, test } from "@playwright/test";

test("storefront and protected routes render", async ({ page }) => {
  await page.goto("./");
  await expect(
    page.getByRole("heading", {
      name: "Your art. Your booth. Your little corner of the con.",
    }),
  ).toBeVisible();

  await page.goto("./dashboard");
  await expect(page.getByText(/Staff sign in|Checking your access|Supabase is not configured/).first()).toBeVisible();

  await page.goto("./dashboard/shops/new");
  await expect(page.getByText(/Staff sign in|Checking your access|Supabase is not configured/).first()).toBeVisible();

  await page.goto("./admin");
  await expect(page.getByText(/Staff sign in|Checking your access|Supabase is not configured/).first()).toBeVisible();
});
