import { expect, test } from "@playwright/test";
import { mockSupabase } from "./fixtures";

test("production storefront starts quickly on a slow uncached connection", async ({
  page,
  context,
}) => {
  test.setTimeout(120000);
  // Mock Supabase calls
  await mockSupabase(page);

  // Clear cookies and local storage to simulate a fresh first load
  await context.clearCookies();
  await page.goto("./s/akiba-shelf");
  await page.evaluate(() => localStorage.clear());
  await page.goto("about:blank");

  // Attach CDP session to throttle network
  const client = await context.newCDPSession(page);
  await client.send("Network.enable");

  // Emulate moderate slow network conditions for dev mode:
  // - Latency: 150ms
  // - Download: 1200 kb/s (150,000 B/s)
  // - Upload: 1200 kb/s (150,000 B/s)
  await client.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 150,
    downloadThroughput: 150_000,
    uploadThroughput: 150_000,
  });

  // Track network request start times
  const requestStartTimes = new Map<string, number>();
  page.on("request", (request) => {
    const url = request.url();
    if (url.includes("/assets/")) {
      const fileName = url.split("/").pop() || "";
      if (!requestStartTimes.has(fileName)) {
        requestStartTimes.set(fileName, Date.now());
      }
    }
  });

  // Navigate to the storefront
  const startTime = Date.now();
  await page.goto("./s/akiba-shelf");

  // Wait for the catalog to finish loading (specifically waiting for products to be visible)
  await expect(page.locator(".product-grid")).toBeVisible({ timeout: 60000 });
  const loadDuration = Date.now() - startTime;
  console.log(`[Perf Test] Page fully loaded in ${loadDuration}ms`);

  await expect(page.locator("script[src*='src/main.tsx']")).toHaveCount(0);

  const modulePreloadLink = page.locator(
    "link[rel='modulepreload'][href*='/assets/App-']",
  );
  await expect(modulePreloadLink).toHaveAttribute(
    "href",
    /\/assets\/App-.*\.js/,
  );
  await expect(page.locator("link[rel='preconnect']")).toHaveAttribute(
    "href",
    "http://127.0.0.1:4174",
  );

  const fileNames = Array.from(requestStartTimes.keys());
  const indexJs = fileNames.find(
    (name) => name.startsWith("index-") && name.endsWith(".js"),
  );
  const appJs = fileNames.find(
    (name) => name.startsWith("App-") && name.endsWith(".js"),
  );
  const catalogPageJs = fileNames.find(
    (name) => name.startsWith("CatalogPage-") && name.endsWith(".js"),
  );
  const paymentModalJs = fileNames.find(
    (name) => name.startsWith("PaymentQrModal-") && name.endsWith(".js"),
  );

  expect(indexJs).toBeDefined();
  expect(appJs).toBeDefined();
  expect(catalogPageJs).toBeDefined();
  expect(paymentModalJs).toBeUndefined();

  const appDiff = Math.abs(
    requestStartTimes.get(appJs!)! - requestStartTimes.get(indexJs!)!,
  );
  console.log(`[Perf Test] App preload start time diff: ${appDiff}ms`);
  expect(appDiff).toBeLessThan(1200);
});
