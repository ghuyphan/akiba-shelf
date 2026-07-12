import { expect, test } from "@playwright/test";
import { mockSupabase } from "./fixtures";

test("rejects an authenticated non-staff user", async ({ page }) => {
  await mockSupabase(page, { staffRole: null });
  await page.goto("./admin");
  await page.getByLabel("Email address").fill("outsider@test.local");
  await page.getByPlaceholder("Enter your password").fill("password123");
  await page.getByRole("button", { name: "Open admin" }).click();
  await expect(page.getByRole("heading", { name: "Staff access required" })).toBeVisible();
});

test("allows authorized staff into orders without restricted settings", async ({ page }) => {
  await mockSupabase(page, { staffRole: "staff" });
  await page.goto("./admin");
  await page.getByLabel("Email address").fill("staff@test.local");
  await page.getByPlaceholder("Enter your password").fill("password123");
  await page.getByRole("button", { name: "Open admin" }).click();
  await expect(page.getByRole("heading", { name: "Orders", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /Products/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Storefront/ })).toHaveCount(0);
});
