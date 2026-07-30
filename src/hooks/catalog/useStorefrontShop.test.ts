import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const {
  getStorefrontBootstrapFast,
  loadShopSnapshot,
  saveShopSnapshot,
  getPublicShop,
} = vi.hoisted(() => ({
  getStorefrontBootstrapFast: vi.fn(),
  loadShopSnapshot: vi.fn(),
  saveShopSnapshot: vi.fn(),
  getPublicShop: vi.fn(),
}));

vi.mock("../../lib/api/storefrontBootstrap", () => ({
  getStorefrontBootstrapFast,
}));
vi.mock("../../lib/api/shops", () => ({ getPublicShop }));
vi.mock("../../lib/offline/offline", () => ({
  loadShopSnapshot,
  saveShopSnapshot,
}));

import { useStorefrontShop } from "./useStorefrontShop";

const shop = {
  id: "shop-1",
  slug: "shop-one",
  name: "Shop One",
  accepting_orders: true,
};

describe("useStorefrontShop", () => {
  afterEach(() => vi.resetAllMocks());

  it("loads and persists the authoritative storefront bootstrap", async () => {
    const onOnline = vi.fn();
    loadShopSnapshot.mockReturnValue(null);
    getStorefrontBootstrapFast.mockResolvedValue({
      shop,
      catalogShopId: "catalog-1",
    });

    const { result } = renderHook(() =>
      useStorefrontShop({
        shopSlug: "shop-one",
        connectError: "Could not connect",
        onOnline,
      }),
    );

    await waitFor(() => expect(result.current.shop).toEqual(shop));
    expect(result.current.catalogShopId).toBe("catalog-1");
    expect(saveShopSnapshot).toHaveBeenCalledWith(shop, "shop-one");
    expect(onOnline).toHaveBeenCalledOnce();
  });

  it("keeps a cached shop available when both remote paths fail", async () => {
    const cachedShop = { ...shop, name: "Cached Shop" };
    loadShopSnapshot.mockReturnValue(cachedShop);
    getStorefrontBootstrapFast.mockRejectedValue(new Error("RPC unavailable"));
    getPublicShop.mockRejectedValue(new Error("Network unavailable"));

    const { result } = renderHook(() =>
      useStorefrontShop({
        shopSlug: "shop-one",
        connectError: "Could not connect",
        onOnline: vi.fn(),
      }),
    );

    await waitFor(() => expect(result.current.shopLoadError).not.toBe(""));
    expect(result.current.shop).toEqual(cachedShop);
    expect(result.current.catalogShopId).toBe("shop-1");
  });

  it("ignores a late response after the storefront slug changes", async () => {
    let resolveFirst: ((value: unknown) => void) | undefined;
    const firstBootstrap = new Promise((resolve) => {
      resolveFirst = resolve;
    });
    const secondShop = { ...shop, id: "shop-2", slug: "shop-two" };
    loadShopSnapshot.mockReturnValue(null);
    getStorefrontBootstrapFast.mockImplementation((slug: string) =>
      slug === "shop-one"
        ? firstBootstrap
        : Promise.resolve({ shop: secondShop, catalogShopId: "catalog-2" }),
    );

    const { result, rerender } = renderHook(
      ({ shopSlug }) =>
        useStorefrontShop({
          shopSlug,
          connectError: "Could not connect",
          onOnline: vi.fn(),
        }),
      { initialProps: { shopSlug: "shop-one" } },
    );

    rerender({ shopSlug: "shop-two" });
    await waitFor(() => expect(result.current.shop).toEqual(secondShop));

    resolveFirst?.({ shop, catalogShopId: "catalog-1" });
    await Promise.resolve();

    expect(result.current.shop).toEqual(secondShop);
    expect(result.current.catalogShopId).toBe("catalog-2");
  });
});
