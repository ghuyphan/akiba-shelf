import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BoothSettings } from "../types/catalog";

const api = vi.hoisted(() => ({
  getGachaCatalog: vi.fn(),
  getPublicBoothSettings: vi.fn(),
  getPublicShop: vi.fn(),
}));

vi.mock("./api", () => api);

import {
  clearGachaLaunchCache,
  isGachaBannerRunning,
  loadGachaLaunch,
  prepareGachaLaunch,
  runningGachaCatalog,
} from "./gachaLaunch";

const shop = {
  id: "shop-1",
  name: "Shop",
  slug: "test-shop",
  active: true,
  accepting_orders: true,
};
const booth = { shop_id: "shop-1", booth_name: "Shop" };
const catalog = {
  settings: { enabled: true, game_type: "hsr" },
  banners: [],
  entries: [],
};

beforeEach(() => {
  clearGachaLaunchCache();
  vi.clearAllMocks();
  api.getPublicShop.mockResolvedValue(shop);
  api.getPublicBoothSettings.mockResolvedValue(booth);
  api.getGachaCatalog.mockResolvedValue(catalog);
});

describe("gacha launch preparation", () => {
  it("keeps only banners running inside their configured window", () => {
    const now = Date.parse("2026-07-18T12:00:00Z");
    const running = {
      id: "running",
      active: true,
      starts_at: "2026-07-18T11:00:00Z",
      ends_at: "2026-07-18T13:00:00Z",
    };
    const future = {
      id: "future",
      active: true,
      starts_at: "2026-07-18T13:00:00Z",
      ends_at: null,
    };

    expect(isGachaBannerRunning(running, now)).toBe(true);
    expect(isGachaBannerRunning(future, now)).toBe(false);
    expect(
      runningGachaCatalog(
        {
          settings: null,
          banners: [running, future],
          entries: [
            { banner_id: "running", product_id: "one" },
            { banner_id: "future", product_id: "two" },
          ],
        } as never,
        now,
      ),
    ).toMatchObject({
      banners: [{ id: "running" }],
      entries: [{ product_id: "one" }],
    });
  });

  it("deduplicates launch requests while navigation is in flight", async () => {
    const first = loadGachaLaunch("test-shop");
    const second = loadGachaLaunch("TEST-SHOP");

    expect(first).toBe(second);
    await expect(first).resolves.toMatchObject({ shop, booth, catalog });
    expect(api.getPublicShop).toHaveBeenCalledTimes(1);
    expect(api.getPublicBoothSettings).toHaveBeenCalledTimes(1);
    expect(api.getGachaCatalog).toHaveBeenCalledTimes(1);
  });

  it("reuses storefront shop and booth data supplied during intent prefetch", async () => {
    await loadGachaLaunch("test-shop", { shop, booth: booth as BoothSettings });

    expect(api.getPublicShop).not.toHaveBeenCalled();
    expect(api.getPublicBoothSettings).not.toHaveBeenCalled();
    expect(api.getGachaCatalog).toHaveBeenCalledWith("shop-1");
  });

  it("evicts failed requests so a later navigation can retry", async () => {
    api.getGachaCatalog
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(catalog);

    await expect(loadGachaLaunch("test-shop")).rejects.toThrow("offline");
    await expect(loadGachaLaunch("test-shop")).resolves.toMatchObject({ catalog });
    expect(api.getGachaCatalog).toHaveBeenCalledTimes(2);
  });

  it("prefetches the selected simulator document after launch data resolves", async () => {
    await prepareGachaLaunch("test-shop");

    expect(
      document.head.querySelector('link[rel="prefetch"][href$="/hsr-simulator/"]'),
    ).not.toBeNull();
  });
});
