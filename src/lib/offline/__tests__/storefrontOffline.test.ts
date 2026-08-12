import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  defaultBooth,
  defaultPayment,
  defaultPromotion,
} from "../../constants";
import type { Product } from "../../../types/catalog";
import {
  isStorefrontOfflineReady,
  prepareStorefrontOffline,
} from "../storefrontOffline";

const mocks = vi.hoisted(() => ({
  ensureOfflineNavigationReady: vi.fn(),
  getCatalogCoreData: vi.fn(),
  getPublicPaymentSettings: vi.fn(),
  getPublicPromotionSettings: vi.fn(),
  getPublicGachaEnabled: vi.fn(),
}));

vi.mock("../pwa", () => ({
  ensureOfflineNavigationReady: mocks.ensureOfflineNavigationReady,
}));
vi.mock("../../api/catalog", () => ({
  getCatalogCoreData: mocks.getCatalogCoreData,
}));
vi.mock("../../api/settings", () => ({
  getPublicPaymentSettings: mocks.getPublicPaymentSettings,
  getPublicPromotionSettings: mocks.getPublicPromotionSettings,
}));
vi.mock("../../api/gachaPublic", () => ({
  getPublicGachaEnabled: mocks.getPublicGachaEnabled,
}));
vi.mock("../../gacha/gachaLaunch", () => ({ prepareGachaLaunch: vi.fn() }));

const product: Product = {
  id: "p1",
  name: "Product",
  collection: "",
  description: "",
  price_vnd: 100,
  item_code: "P1",
  quantity_available: 2,
  category: "Test",
  stock_status: "limited",
  stock_note: "Limited",
  images: ["https://cdn.test/new.webp"],
  featured: false,
  sort_order: 1,
  active: true,
};

describe("storefront offline preparation", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    mocks.ensureOfflineNavigationReady.mockResolvedValue({});
    mocks.getCatalogCoreData.mockResolvedValue({
      products: [product],
      booth: defaultBooth,
    });
    mocks.getPublicPaymentSettings.mockResolvedValue(defaultPayment);
    mocks.getPublicPromotionSettings.mockResolvedValue(defaultPromotion);
    mocks.getPublicGachaEnabled.mockResolvedValue(false);
  });

  it("clears stale readiness before replacing a storefront offline save", async () => {
    localStorage.setItem(
      "matsuri-storefront-offline-v2:test-shop",
      JSON.stringify({
        version: 4,
        shopId: "shop-1",
        savedAt: new Date().toISOString(),
        required: [],
      }),
    );
    vi.stubGlobal("caches", {
      open: vi.fn(async () => ({ put: vi.fn() })),
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network failed");
      }),
    );

    await expect(
      prepareStorefrontOffline({
        id: "shop-1",
        name: "Test shop",
        slug: "test-shop",
        active: true,
        accepting_orders: true,
      }),
    ).rejects.toThrow("network failed");

    expect(
      localStorage.getItem("matsuri-storefront-offline-v2:test-shop"),
    ).toBeNull();
    expect(isStorefrontOfflineReady("test-shop")).toBe(false);
  });

  it("preserves a valid existing save when setup fails before replacement", async () => {
    const marker = JSON.stringify({
      version: 4,
      shopId: "shop-1",
      savedAt: new Date().toISOString(),
      required: [],
    });
    localStorage.setItem("matsuri-storefront-offline-v2:test-shop", marker);
    mocks.ensureOfflineNavigationReady.mockRejectedValue(
      new Error("worker unavailable"),
    );
    vi.stubGlobal("caches", {});

    await expect(
      prepareStorefrontOffline({
        id: "shop-1",
        name: "Test shop",
        slug: "test-shop",
        active: true,
        accepting_orders: true,
      }),
    ).rejects.toThrow("worker unavailable");

    expect(
      localStorage.getItem("matsuri-storefront-offline-v2:test-shop"),
    ).toBe(marker);
  });
});
