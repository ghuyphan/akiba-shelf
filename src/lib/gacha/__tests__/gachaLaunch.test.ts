import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BoothSettings } from "../../../types/catalog";
import { defaultGachaSettings } from "../../../types/gacha";
import { defaultBooth } from "../../constants";

const api = vi.hoisted(() => ({
  getGachaCatalogs: vi.fn(),
  getPublicBoothSettings: vi.fn(),
  getPublicShop: vi.fn(),
}));

vi.mock("../../api/gacha", () => ({
  getGachaCatalogs: api.getGachaCatalogs,
}));
vi.mock("../../api/settings", () => ({
  getPublicBoothSettings: api.getPublicBoothSettings,
}));
vi.mock("../../api/shops", () => ({
  getPublicShop: api.getPublicShop,
}));

import {
  clearGachaLaunchCache,
  isGachaBannerRunning,
  loadGachaLaunch,
  prepareGachaLaunch,
  refreshGachaLaunch,
  runningGachaCatalog,
} from "../gachaLaunch";

const shop = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Shop",
  slug: "test-shop",
  active: true,
  accepting_orders: true,
};
const booth = {
  ...defaultBooth,
  shop_id: "11111111-1111-4111-8111-111111111111",
  booth_name: "Shop",
};
const catalog = {
  settings: {
    ...defaultGachaSettings("11111111-1111-4111-8111-111111111111"),
    enabled: true,
    game_type: "hsr" as const,
  },
  banners: [],
  entries: [],
};

beforeEach(() => {
  clearGachaLaunchCache();
  localStorage.clear();
  vi.clearAllMocks();
  api.getPublicShop.mockResolvedValue(shop);
  api.getPublicBoothSettings.mockResolvedValue(booth);
  api.getGachaCatalogs.mockResolvedValue({ hsr: catalog });
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
            { banner_id: "running", product_id: "one", rarity: 3 },
            { banner_id: "future", product_id: "two", rarity: 3 },
          ],
        } as never,
        now,
      ),
    ).toMatchObject({
      banners: [{ id: "running" }],
      entries: expect.arrayContaining([
        expect.objectContaining({ product_id: "one" }),
      ]),
    });
  });

  it("gives generated 3-star souvenirs artwork that simulators can render", () => {
    const prepared = runningGachaCatalog({
      settings: catalog.settings,
      banners: [
        { id: "running", active: true, starts_at: null, ends_at: null },
      ],
      entries: [
        { banner_id: "running", product_id: "four", rarity: 4 },
        { banner_id: "running", product_id: "five", rarity: 5 },
      ],
    } as never);

    const fallback = prepared.entries.find((entry) => entry.rarity === 3);
    expect(fallback?.product.images[0]).toMatch(
      /brand\/matsuri-icon-512\.png$/,
    );
  });

  it("keeps a shared 3-star pool available when multiple banners are running", () => {
    const prepared = runningGachaCatalog({
      settings: { ...catalog.settings, game_type: "genshin" },
      banners: [
        { id: "first", active: true, starts_at: null, ends_at: null },
        { id: "second", active: true, starts_at: null, ends_at: null },
      ],
      entries: [
        { banner_id: "first", product_id: "shared-three", rarity: 3 },
        { banner_id: "second", product_id: "second-five", rarity: 5 },
      ],
    } as never);

    expect(prepared.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ product_id: "shared-three", rarity: 3 }),
        expect.objectContaining({ product_id: "second-five", rarity: 5 }),
      ]),
    );
  });

  it("deduplicates launch requests while navigation is in flight", async () => {
    const first = loadGachaLaunch("test-shop");
    const second = loadGachaLaunch("TEST-SHOP");

    expect(first).toBe(second);
    await expect(first).resolves.toMatchObject({
      shop,
      booth,
      catalogs: { hsr: catalog },
    });
    expect(api.getPublicShop).toHaveBeenCalledTimes(1);
    expect(api.getPublicBoothSettings).toHaveBeenCalledTimes(1);
    expect(api.getGachaCatalogs).toHaveBeenCalledTimes(1);
  });

  it("reuses storefront shop and booth data supplied during intent prefetch", async () => {
    await loadGachaLaunch("test-shop", { shop, booth: booth as BoothSettings });

    expect(api.getPublicShop).not.toHaveBeenCalled();
    expect(api.getPublicBoothSettings).not.toHaveBeenCalled();
    expect(api.getGachaCatalogs).toHaveBeenCalledWith(shop.id);
  });

  it("evicts failed requests so a later navigation can retry", async () => {
    api.getGachaCatalogs
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce({ hsr: catalog });

    await expect(loadGachaLaunch("test-shop")).rejects.toThrow("offline");
    await expect(loadGachaLaunch("test-shop")).resolves.toMatchObject({
      catalogs: { hsr: catalog },
    });
    expect(api.getGachaCatalogs).toHaveBeenCalledTimes(2);
  });

  it("prefetches the selected simulator document after launch data resolves", async () => {
    await prepareGachaLaunch("test-shop");

    expect(
      document.head.querySelector(
        'link[rel="prefetch"][href$="/hsr-simulator/"]',
      ),
    ).not.toBeNull();
  });

  it("renders a stored launch immediately while refreshing it in the background", async () => {
    await loadGachaLaunch("test-shop");
    clearGachaLaunchCache();
    api.getPublicShop.mockImplementation(() => new Promise(() => undefined));

    await expect(loadGachaLaunch("test-shop")).resolves.toMatchObject({
      shop,
      booth,
      catalogs: { hsr: catalog },
    });
  });

  it("replaces a stored launch when an online refresh completes", async () => {
    await loadGachaLaunch("test-shop");
    clearGachaLaunchCache();
    const freshCatalog = {
      ...catalog,
      settings: { ...catalog.settings, title: "Fresh pool" },
    };
    api.getGachaCatalogs.mockResolvedValue({ hsr: freshCatalog });

    await expect(loadGachaLaunch("test-shop")).resolves.toMatchObject({
      catalogs: { hsr: catalog },
    });
    await expect(refreshGachaLaunch("test-shop")).resolves.toMatchObject({
      catalogs: { hsr: freshCatalog },
    });
  });
});
