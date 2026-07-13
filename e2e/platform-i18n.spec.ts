import { expect, test } from "@playwright/test";

test("platform locale menu persists without horizontal overflow", async ({ page }) => {
  await page.goto("./");

  await page.getByRole("button", { name: "Language: English" }).click();
  await page.getByRole("option", { name: "Tiếng Việt" }).click();

  await expect(
    page.getByRole("heading", {
      name: "Tác phẩm của bạn. Gian hàng của bạn. Góc nhỏ của bạn tại hội chợ.",
    }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Ngôn ngữ: Tiếng Việt" })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);

  await page.goto("./auth?mode=signin");
  await expect(page.getByRole("heading", { name: "Chào mừng bạn trở lại" })).toBeVisible();
  await expect(page.getByText("Truy cập an toàn vào gian hàng và không gian làm việc của staff.")).toBeVisible();
  await expect(page.locator(".platform-language-menu")).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
