import path from "node:path";
import { expect, test } from "@playwright/test";
import { mockSupabase } from "./fixtures";

type BrowserPerfMetrics = {
  lcp: number;
  lcpElement: string;
  lcpText: string;
  lcpParent: string;
  lcpUrl: string;
  cls: number;
  longestTask: number;
  maxInteraction: number;
};

const STOREFRONT_CONTENT_READY_BUDGET_MS = 5000;

test("production storefront stays within mobile-class performance budgets", async ({
  page,
  context,
}, testInfo) => {
  test.setTimeout(120000);
  await mockSupabase(page, { productCount: 120 });
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
      lcpElement: "",
      lcpText: "",
      lcpParent: "",
      lcpUrl: "",
      cls: 0,
      longestTask: 0,
      maxInteraction: 0,
    };
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const largest = entry as PerformanceEntry & {
          element?: Element;
          url?: string;
        };
        target.__storefrontPerf.lcp = Math.max(
          target.__storefrontPerf.lcp,
          entry.startTime,
        );
        target.__storefrontPerf.lcpElement =
          largest.element?.className?.toString() ||
          largest.element?.tagName ||
          "text";
        target.__storefrontPerf.lcpText =
          largest.element?.textContent?.trim().slice(0, 80) ?? "";
        target.__storefrontPerf.lcpParent =
          largest.element?.parentElement?.className?.toString() ?? "";
        target.__storefrontPerf.lcpUrl = largest.url ?? "";
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
  const initialDataRequests: string[] = [];
  page.on("request", (request) => {
    const url = request.url();
    if (url.includes("/mock-supabase/")) {
      initialDataRequests.push(new URL(url).pathname);
    }
    if (url.includes("/assets/")) {
      const fileName = url.split("/").pop() || "";
      if (!requestStartTimes.has(fileName)) {
        requestStartTimes.set(fileName, Date.now());
      }
    }
  });

  await page.goto("./s/akiba-shelf");
  const firstProduct = page.locator(".product-grid .product-card").first();
  await expect(firstProduct).toBeVisible({ timeout: 60000 });
  await expect(firstProduct.locator(".product-add-button")).toBeEnabled();
  await expect(page.locator(".page-loading")).toHaveCount(0);
  const contentReady = await page.evaluate(() => performance.now());
  await page.waitForTimeout(250);
  const pageLoadMetrics = await page.evaluate(() => {
    const target = window as Window & { __storefrontPerf: BrowserPerfMetrics };
    const paints = performance.getEntriesByType("paint");
    return {
      lcp: target.__storefrontPerf.lcp,
      lcpElement: target.__storefrontPerf.lcpElement,
      lcpText: target.__storefrontPerf.lcpText,
      lcpParent: target.__storefrontPerf.lcpParent,
      lcpUrl: target.__storefrontPerf.lcpUrl,
      cls: target.__storefrontPerf.cls,
      fcp:
        paints.find((entry) => entry.name === "first-contentful-paint")
          ?.startTime ?? 0,
    };
  });
  const lcpIsLoadingShell = [
    pageLoadMetrics.lcpElement,
    pageLoadMetrics.lcpParent,
  ].some((value) => value.includes("page-loading"));

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
    return target.__storefrontPerf;
  });

  console.log(
    `[Perf Test:${testInfo.project.name}] contentReady=${Math.round(contentReady)}ms fcp=${Math.round(pageLoadMetrics.fcp)}ms browserLcp=${Math.round(pageLoadMetrics.lcp)}ms lcpSource=${lcpIsLoadingShell ? "loading-shell" : "storefront"} lcpElement=${pageLoadMetrics.lcpElement} lcpText=${pageLoadMetrics.lcpText} lcpParent=${pageLoadMetrics.lcpParent} lcpUrl=${pageLoadMetrics.lcpUrl || "text"} cls=${pageLoadMetrics.cls.toFixed(4)} longestTask=${Math.round(metrics.longestTask)}ms interaction=${Math.round(Math.max(interactionDuration, metrics.maxInteraction))}ms requests=${requestCount} encoded=${Math.round(encodedBytes / 1024)}KiB`,
  );

  // Browser LCP can legitimately select the loading shell. This separate gate
  // measures when a customer can see and act on real storefront content.
  expect(contentReady).toBeLessThan(STOREFRONT_CONTENT_READY_BUDGET_MS);
  expect(pageLoadMetrics.fcp).toBeGreaterThan(0);
  expect(pageLoadMetrics.fcp).toBeLessThan(4000);
  expect(pageLoadMetrics.lcp).toBeGreaterThan(0);
  expect(pageLoadMetrics.lcp).toBeLessThan(2500);
  expect(pageLoadMetrics.cls).toBeLessThan(0.1);
  expect(metrics.longestTask).toBeLessThan(300);
  expect(Math.max(interactionDuration, metrics.maxInteraction)).toBeLessThan(
    500,
  );
  expect(requestCount).toBeLessThan(45);
  expect(encodedBytes).toBeLessThan(450 * 1024);

  expect(
    initialDataRequests.filter((path) =>
      path.endsWith("/rest/v1/rpc/get_storefront_bootstrap"),
    ),
  ).toHaveLength(1);
  for (const replacedPath of [
    "/rest/v1/shops",
    "/rest/v1/products",
    "/rest/v1/booth_settings",
    "/rest/v1/promotions",
    "/rest/v1/promotion_products",
    "/rest/v1/gacha_published_configs",
  ]) {
    expect(
      initialDataRequests.filter((path) => path.endsWith(replacedPath)),
      `${replacedPath} should be folded into the bootstrap RPC`,
    ).toHaveLength(0);
  }

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
