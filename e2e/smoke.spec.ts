import { expect, test } from "@playwright/test";

test("storefront and protected routes render", async ({ page }) => {
  await page.goto("./");
  await expect(
    page.getByRole("heading", {
      name: "Run your merch booth. Stay in sync.",
    }),
  ).toBeVisible();

  await page.goto("./dashboard");
  await expect(
    page
      .getByText(
        /Staff sign in|Checking your access|Supabase is not configured/,
      )
      .first(),
  ).toBeVisible();

  await page.goto("./dashboard/shops/new");
  await expect(
    page
      .getByText(
        /Staff sign in|Checking your access|Supabase is not configured/,
      )
      .first(),
  ).toBeVisible();

  await page.goto("./admin");
  await expect(
    page
      .getByText(
        /Staff sign in|Checking your access|Supabase is not configured/,
      )
      .first(),
  ).toBeVisible();
});

test("phone interactions suppress the native blue tap flash", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "phone-chromium");
  await page.goto("./");

  for (const locator of [
    page.locator("a").first(),
    page.locator("button").first(),
  ]) {
    await expect(locator).toBeVisible();
    const tapColor = await locator.evaluate(
      (element) => getComputedStyle(element).webkitTapHighlightColor,
    );
    expect(["transparent", "rgba(0, 0, 0, 0)"]).toContain(tapColor);
  }
});
