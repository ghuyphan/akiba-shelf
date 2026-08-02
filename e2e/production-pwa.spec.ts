import { expect, test } from "@playwright/test";
import { mockSupabase } from "./fixtures";

const staleAppAssetRecoveryScript = `
void (async () => {
  const registration = await navigator.serviceWorker.getRegistration("/");
  await registration?.update();
  location.reload();
})();
throw new Error("Matsuri is updating a retired application asset.");
`;

test("reloads a production storefront while offline", async ({
  browserName,
  context,
  page,
}) => {
  test.skip(
    browserName === "webkit",
    "Playwright WebKit cannot reliably reload an emulated offline context.",
  );
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

test("recovers a tab that requests a retired application script", async ({
  page,
}) => {
  await mockSupabase(page);
  await page.route("**/assets/index-BPGrAREH.js", (route) =>
    route.fulfill({
      body: staleAppAssetRecoveryScript,
      contentType: "application/javascript; charset=utf-8",
      headers: {
        "cache-control": "no-cache, no-store, must-revalidate",
        "x-matsuri-stale-asset": "recover",
      },
    }),
  );
  await page.goto("./s/akiba-shelf");
  await expect(
    page.getByRole("button", { name: /Add Moon Stand to cart/i }),
  ).toBeVisible();

  await Promise.all([
    page.waitForNavigation({ waitUntil: "domcontentloaded" }),
    page.evaluate(() => {
      const script = document.createElement("script");
      script.type = "module";
      script.src = "/assets/index-BPGrAREH.js";
      document.head.append(script);
    }),
  ]);

  const navigationType = await page.evaluate(
    () =>
      (
        performance.getEntriesByType("navigation")[0] as
          | PerformanceNavigationTiming
          | undefined
      )?.type,
  );
  expect(navigationType).toBe("reload");
  await expect(
    page.getByRole("button", { name: /Add Moon Stand to cart/i }),
  ).toBeVisible();
});
