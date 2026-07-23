import path from "node:path";
import { expect, test } from "@playwright/test";
import { mockSupabase } from "./fixtures";

type BrowserPerfMetrics = {
  lcp: number;
  cls: number;
  longestTask: number;
  maxInteraction: number;
};

test("production storefront stays within mobile-class performance budgets", async ({
  page,
  context,
}, testInfo) => {
  test.setTimeout(120000);
  await mockSupabase(page);
  await page.route("https://example.test/*.jpg", (route) =>
    route.fulfill({
      path: path.resolve(process.cwd(), "public/brand/matsuri-icon-512.png"),
      contentType: "image/png",
      headers: { "access-control-allow-origin": "*" },
    }),
  );
  await context.clearCookies();
  await page.addInitScript(() => {
    localStorage.clear();
    const target = window as Window & { __storefrontPerf: BrowserPerfMetrics };
    target.__storefrontPerf = {
      lcp: 0,
      cls: 0,
      longestTask: 0,
      maxInteraction: 0,
    };
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        target.__storefrontPerf.lcp = Math.max(
          target.__storefrontPerf.lcp,
          entry.startTime,
        );
      }
    }).observe({ type: "largest-contentful-paint", buffered: true });
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const shift = entry as PerformanceEntry & {
          hadRecentInput?: boolean;
          value?: number;
        };
        if (!shift.hadRecentInput)
          target.__storefrontPerf.cls += shift.value ?? 0;
      }
    }).observe({ type: "layout-shift", buffered: true });
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        target.__storefrontPerf.longestTask = Math.max(
          target.__storefrontPerf.longestTask,
          entry.duration,
        );
      }
    }).observe({ type: "longtask", buffered: true });
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          target.__storefrontPerf.maxInteraction = Math.max(
            target.__storefrontPerf.maxInteraction,
            entry.duration,
          );
        }
      }).observe({
        type: "event",
        buffered: true,
        durationThreshold: 16,
      } as PerformanceObserverInit);
    } catch {
      // Older Chromium builds still exercise the explicit interaction timer below.
    }
  });

  const client = await context.newCDPSession(page);
  await client.send("Network.enable");
  await client.send("Network.setCacheDisabled", { cacheDisabled: true });
  await client.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 150,
    downloadThroughput: 150_000,
    uploadThroughput: 150_000,
  });
  await client.send("Emulation.setCPUThrottlingRate", {
    rate: testInfo.project.name === "phone-chromium" ? 4 : 2,
  });

  let encodedBytes = 0;
  let requestCount = 0;
  client.on("Network.loadingFinished", (event) => {
    encodedBytes += event.encodedDataLength;
    requestCount += 1;
  });

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

  const startTime = Date.now();
  await page.goto("./s/akiba-shelf");
  await expect(page.locator(".product-grid")).toBeVisible({ timeout: 60000 });
  const loadDuration = Date.now() - startTime;

  const interactionDuration = await page.evaluate(async () => {
    const button = document.querySelector<HTMLButtonElement>(
      ".view-toggle button:nth-child(2)",
    );
    if (!button) throw new Error("List-view control is unavailable.");
    const startedAt = performance.now();
    button.click();
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
    return performance.now() - startedAt;
  });
  await expect(page.locator(".product-grid")).toHaveClass(/product-grid-list/);
  await page.waitForTimeout(250);

  const metrics = await page.evaluate(() => {
    const target = window as Window & { __storefrontPerf: BrowserPerfMetrics };
    const paints = performance.getEntriesByType("paint");
    return {
      ...target.__storefrontPerf,
      fcp:
        paints.find((entry) => entry.name === "first-contentful-paint")
          ?.startTime ?? 0,
    };
  });

  console.log(
    `[Perf Test:${testInfo.project.name}] grid=${loadDuration}ms fcp=${Math.round(metrics.fcp)}ms lcp=${Math.round(metrics.lcp)}ms cls=${metrics.cls.toFixed(4)} longestTask=${Math.round(metrics.longestTask)}ms interaction=${Math.round(Math.max(interactionDuration, metrics.maxInteraction))}ms requests=${requestCount} encoded=${Math.round(encodedBytes / 1024)}KiB`,
  );

  expect(loadDuration).toBeLessThan(9000);
  expect(metrics.fcp).toBeGreaterThan(0);
  expect(metrics.fcp).toBeLessThan(4000);
  expect(metrics.lcp).toBeGreaterThan(0);
  expect(metrics.lcp).toBeLessThan(5000);
  expect(metrics.cls).toBeLessThan(0.1);
  expect(metrics.longestTask).toBeLessThan(300);
  expect(Math.max(interactionDuration, metrics.maxInteraction)).toBeLessThan(500);
  expect(requestCount).toBeLessThan(45);
  expect(encodedBytes).toBeLessThan(450 * 1024);

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
  const shopUnavailableJs = fileNames.find(
    (name) => name.startsWith("ShopUnavailablePage-") && name.endsWith(".js"),
  );
  const platformI18nJs = fileNames.find(
    (name) => name.startsWith("platformI18n-") && name.endsWith(".js"),
  );
  const adminCss = fileNames.find(
    (name) => name.startsWith("admin-") && name.endsWith(".css"),
  );

  expect(indexJs).toBeDefined();
  expect(appJs).toBeDefined();
  expect(catalogPageJs).toBeDefined();
  expect(paymentModalJs).toBeUndefined();
  expect(shopUnavailableJs).toBeUndefined();
  expect(platformI18nJs).toBeUndefined();
  expect(adminCss).toBeUndefined();

  const appDiff = Math.abs(
    requestStartTimes.get(appJs!)! - requestStartTimes.get(indexJs!)!,
  );
  expect(appDiff).toBeLessThan(1200);
});
