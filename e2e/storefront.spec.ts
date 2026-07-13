import { expect, test } from "@playwright/test";
import { mockSupabase } from "./fixtures";

test.beforeEach(async ({ page }) => {
  await mockSupabase(page);
  await page.goto("./s/akiba-shelf");
});

test("browses, filters, searches, opens details, and enforces quantity limits", async ({
  page,
}) => {
  await expect(page.getByText("Fixture Booth").first()).toBeVisible();
  await page.getByPlaceholder("Search items...").fill("Sun");
  await expect(page.getByText("Sun Print").first()).toBeVisible();
  await expect(
    page.getByRole("button", { name: /View details for Moon Stand/i }),
  ).toHaveCount(0);
  await page.getByPlaceholder("Search items...").fill("");
  await page
    .getByRole("button", { name: /View details for Moon Stand/i })
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "A bright acrylic stand",
  );
  await page
    .getByRole("button", { name: /Add to cart/i })
    .last()
    .click();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: /Add Moon Stand to cart/i }).click();
  await page.getByRole("button", { name: /Add Moon Stand to cart/i }).click();
  await expect(page.getByText(/Only 2 units are available/i)).toBeVisible();
});

test("loads payment settings before checkout and presents API failure", async ({
  page,
}) => {
  await page.unrouteAll({ behavior: "wait" });
  await mockSupabase(page, { checkoutFails: true });
  await page.reload();
  await page.getByRole("button", { name: /Add Moon Stand to cart/i }).click();
  const viewCart = page.getByRole("button", { name: /View cart/i });
  if (await viewCart.isVisible()) {
    await viewCart.click();
  }
  await page.getByRole("button", { name: /Pay now/i }).click();
  await page.getByLabel(/Pickup name/i).fill("Customer");
  await page.getByRole("button", { name: /Create order & pay/i }).click();
  await expect(page.getByText(/Failed to submit order/i)).toBeVisible();
});

test("isolates storefront state when navigating between shops", async ({
  page,
}) => {
  await page.unrouteAll({ behavior: "wait" });
  await mockSupabase(page, { multiShop: true });
  await page.goto("./s/shop-a");
  await expect(page.getByText("Booth id-shop-a").first()).toBeVisible();
  await expect(page.getByText("id-shop-a Moon Stand").first()).toBeVisible();

  await page.goto("./s/shop-b");
  await expect(page).toHaveURL(/\/s\/shop-b$/);
  await expect(page.getByText("Booth id-shop-a")).toHaveCount(0);
  await expect(page.getByText("id-shop-a Moon Stand")).toHaveCount(0);
  await expect(page.getByText("Booth id-shop-b").first()).toBeVisible();
  await expect(page.getByText("id-shop-b Moon Stand").first()).toBeVisible();
});
