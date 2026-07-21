import { beforeEach, describe, expect, it } from "vitest";
import {
  loadCart,
  loadCatalogSnapshot,
  replaceCompleteCatalogSnapshot,
  saveCart,
  saveCatalogSnapshot,
} from "../offline";
import type { CartItem, Product } from "../../../types/catalog";
import { defaultBooth } from "../../constants";
import { isStorefrontOfflineReady } from "../storefrontOffline";

const product: Product = { id: "p1", name: "Product", collection: "", description: "", price_vnd: 100, item_code: "P1", quantity_available: 2, category: "Test", stock_status: "limited", stock_note: "Limited", images: [], featured: false, sort_order: 1, active: true };

describe("offline cart persistence", () => {
  beforeEach(() => localStorage.clear());
  it("round-trips valid carts", () => { const items: CartItem[] = [{ product, quantity: 2 }]; saveCart(items); expect(loadCart()).toEqual(items); });
  it("clears invalid or over-trusting stored data", () => { localStorage.setItem("akiba-shelf-cart-v1", JSON.stringify({ version: 1, items: [{ product, quantity: 0 }] })); expect(loadCart()).toEqual([]); expect(localStorage.getItem("akiba-shelf-cart-v1")).toBeNull(); });

  it("replaces a complete catalog so deleted products do not survive offline", () => {
    const removedProduct = { ...product, id: "removed", item_code: "REMOVED" };
    saveCatalogSnapshot(
      { products: [product, removedProduct], booth: defaultBooth },
      "shop-1",
      { replaceProducts: true, complete: true },
    );
    saveCatalogSnapshot(
      { products: [product], booth: defaultBooth },
      "shop-1",
      { replaceProducts: true, complete: true },
    );

    expect(loadCatalogSnapshot("shop-1")).toMatchObject({
      products: [product],
      complete: true,
    });
  });

  it("reconciles an authoritative refresh only into complete snapshots", () => {
    const removedProduct = { ...product, id: "removed", item_code: "REMOVED" };
    saveCatalogSnapshot(
      { products: [product, removedProduct], booth: defaultBooth },
      "complete-shop",
      { replaceProducts: true, complete: true },
    );
    saveCatalogSnapshot(
      { products: [product, removedProduct], booth: defaultBooth },
      "partial-shop",
    );

    expect(
      replaceCompleteCatalogSnapshot(
        { products: [product], booth: defaultBooth },
        "complete-shop",
      ),
    ).toBe(true);
    expect(
      replaceCompleteCatalogSnapshot(
        { products: [product], booth: defaultBooth },
        "partial-shop",
      ),
    ).toBe(false);

    expect(loadCatalogSnapshot("complete-shop")?.products).toEqual([product]);
    expect(loadCatalogSnapshot("partial-shop")?.products).toEqual([
      product,
      removedProduct,
    ]);
  });

  it("requires a complete catalog before claiming a storefront is offline-ready", () => {
    localStorage.setItem(
      "matsuri-storefront-offline-v2:test-shop",
      JSON.stringify({ version: 3, shopId: "shop-1", savedAt: new Date().toISOString() }),
    );
    saveCatalogSnapshot(
      { products: [product], booth: defaultBooth },
      "shop-1",
    );
    expect(isStorefrontOfflineReady("test-shop")).toBe(false);

    saveCatalogSnapshot(
      { products: [product], booth: defaultBooth },
      "shop-1",
      { replaceProducts: true, complete: true },
    );
    expect(isStorefrontOfflineReady("test-shop")).toBe(true);
  });
});
