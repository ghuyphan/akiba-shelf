import { expect, test } from "@playwright/test";
import { mockSupabase } from "./fixtures";

test("reloads a production storefront while offline", async ({
  context,
  page,
}) => {
  await mockSupabase(page);
  await page.goto("./s/akiba-shelf");
  await expect(
    page.getByRole("button", { name: /Add Moon Stand to cart/i }),
  ).toBeVisible();
  await expect
    .poll(
      () => page.evaluate(() => Boolean(navigator.serviceWorker.controller)),
      {
        timeout: 30_000,
      },
    )
    .toBe(true);

  await page.unrouteAll({ behavior: "wait" });
  const offlineApiResponses: string[] = [];
  page.on("response", (response) => {
    if (response.url().includes("/mock-supabase/"))
      offlineApiResponses.push(response.url());
  });
  await context.setOffline(true);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("button", { name: /Add Moon Stand to cart/i }),
  ).toBeVisible();
  expect(offlineApiResponses).toEqual([]);
});
