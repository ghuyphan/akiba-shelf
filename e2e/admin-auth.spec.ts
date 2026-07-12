import { expect, test } from "@playwright/test";
import { mockSupabase } from "./fixtures";

test("rejects an authenticated non-staff user", async ({ page }) => {
  await mockSupabase(page, { staffRole: null });
  await page.goto("./admin");
  await page.getByLabel("Email address").fill("outsider@test.local");
  await page.getByPlaceholder("Enter your password").fill("password123");
  await page.getByRole("button", { name: "Open admin" }).click();
  await expect(
    page.getByRole("heading", { name: "Staff access required" }),
  ).toBeVisible();
});

test("allows authorized staff into orders without restricted settings", async ({
  page,
}) => {
  await mockSupabase(page, { staffRole: "staff" });
  await page.goto("./admin");
  await page.getByLabel("Email address").fill("staff@test.local");
  await page.getByPlaceholder("Enter your password").fill("password123");
  await page.getByRole("button", { name: "Open admin" }).click();
  await expect(
    page.getByRole("heading", { name: "Orders", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Orders Queue/ }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /Products/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Storefront/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Settings/ })).toHaveCount(0);
});

for (const role of ["owner", "admin"] as const) {
  test(`${role} sees every permitted workspace`, async ({ page }) => {
    await mockSupabase(page, { staffRole: role });
    await page.goto("./admin");
    await page.getByLabel("Email address").fill(`${role}@test.local`);
    await page.getByPlaceholder("Enter your password").fill("password123");
    await page.getByRole("button", { name: "Open admin" }).click();
    await expect(
      page.getByRole("button", { name: /Orders Queue/ }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /Products/ })).toBeVisible();
    if (page.viewportSize()!.width > 760)
      await expect(
        page.getByRole("button", { name: /Storefront/ }),
      ).toBeVisible();
    else
      await expect(
        page.getByRole("button", { name: /Settings/ }),
      ).toBeVisible();
  });
}

test("rejects inactive staff", async ({ page }) => {
  await mockSupabase(page, { staffRole: "staff", staffActive: false });
  await page.goto("./admin");
  await page.getByLabel("Email address").fill("inactive@test.local");
  await page.getByPlaceholder("Enter your password").fill("password123");
  await page.getByRole("button", { name: "Open admin" }).click();
  await expect(
    page.getByRole("heading", { name: "Staff access inactive" }),
  ).toBeVisible();
});

test("designer phone rules apply inside the preview iframe", async ({
  page,
}) => {
  test.skip(
    page.viewportSize()!.width <= 760,
    "The designer is intentionally replaced by Settings on phone admin viewports.",
  );
  await mockSupabase(page, { staffRole: "owner" });
  await page.goto("./admin");
  await page.getByLabel("Email address").fill("owner@test.local");
  await page.getByPlaceholder("Enter your password").fill("password123");
  await page.getByRole("button", { name: "Open admin" }).click();
  await page.getByRole("button", { name: /Storefront/ }).click();
  await page.getByRole("button", { name: "Phone" }).click();
  const preview = page.frameLocator('iframe[title="phone storefront preview"]');
  await expect(preview.locator("body")).toHaveClass(
    /designer-preview-document/,
  );
  await expect(preview.locator("body")).toHaveClass(/device-phone/);
  await expect(preview.locator(".product-grid")).toBeVisible();
  await preview.getByRole("button", { name: /Booth info/ }).click();
  await expect(page.locator(".builder-section-heading strong")).toHaveText(
    "Booth information",
  );
});
