import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  defaultBooth,
  defaultPayment,
  defaultPromotion,
} from "../../lib/constants";
import type { CatalogData, Product } from "../../types/catalog";

const mocks = vi.hoisted(() => ({
  getAdminCatalogData: vi.fn(),
  loadCatalogSnapshot: vi.fn(),
  saveCatalogSnapshot: vi.fn(),
  subscribeToCatalogChanges: vi.fn(),
  unsubscribe: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("../../components/ui/ToastProvider", () => ({
  useToast: () => ({ error: mocks.toastError }),
}));
vi.mock("../../lib/api/catalog", () => ({
  getAdminCatalogData: mocks.getAdminCatalogData,
}));
vi.mock("../../lib/i18n/platformI18n", () => ({
  usePlatformI18n: () => ({ t: (value: string) => value }),
}));
vi.mock("../../lib/offline/offline", () => ({
  loadCatalogSnapshot: mocks.loadCatalogSnapshot,
  saveCatalogSnapshot: mocks.saveCatalogSnapshot,
}));
vi.mock("../../lib/realtime", () => ({
  subscribeToCatalogChanges: mocks.subscribeToCatalogChanges,
}));
vi.mock("../../utils/themeStorage", () => ({
  getStoredBoothTheme: () => defaultBooth,
}));

import { useAdminCatalogWorkspace } from "./useAdminCatalogWorkspace";

const product: Product = {
  id: "product-1",
  name: "Product",
  collection: "",
  description: "",
  price_vnd: 100,
  item_code: "P1",
  quantity_available: 2,
  category: "Test",
  stock_status: "in_stock",
  stock_note: "",
  images: [],
  featured: false,
  sort_order: 1,
  active: true,
};

function catalog(shopId: string): CatalogData {
  return {
    products: [{ ...product, shop_id: shopId }],
    booth: { ...defaultBooth, shop_id: shopId },
    payment: { ...defaultPayment, shop_id: shopId },
    promotion: { ...defaultPromotion, shop_id: shopId },
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

describe("useAdminCatalogWorkspace", () => {
  beforeEach(() => {
    localStorage.clear();
    mocks.subscribeToCatalogChanges.mockReturnValue(mocks.unsubscribe);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("deduplicates concurrent loads and stores the complete catalog", async () => {
    const response = deferred<CatalogData>();
    mocks.getAdminCatalogData.mockReturnValue(response.promise);
    const { result } = renderHook(() =>
      useAdminCatalogWorkspace({ enabled: true, shopId: "shop-1" }),
    );

    let first!: Promise<void>;
    let second!: Promise<void>;
    act(() => {
      first = result.current.reload();
      second = result.current.reload();
    });
    expect(first).toBe(second);
    response.resolve(catalog("shop-1"));

    await waitFor(() => expect(result.current.loadedShopId).toBe("shop-1"));
    expect(result.current.products).toEqual([
      { ...product, shop_id: "shop-1" },
    ]);
    expect(mocks.saveCatalogSnapshot).toHaveBeenCalledWith(
      catalog("shop-1"),
      "shop-1",
      { replaceProducts: true, complete: true },
    );
  });

  it("ignores a catalog response after the active shop changes", async () => {
    const response = deferred<CatalogData>();
    mocks.getAdminCatalogData.mockReturnValue(response.promise);
    const { result, rerender } = renderHook(
      ({ shopId }) => useAdminCatalogWorkspace({ enabled: true, shopId }),
      { initialProps: { shopId: "shop-1" } },
    );

    act(() => {
      void result.current.reload();
    });
    rerender({ shopId: "shop-2" });
    response.resolve(catalog("shop-1"));

    await act(async () => response.promise);
    expect(result.current.catalogLoading).toBe(false);
    expect(result.current.loadedShopId).toBe("");
    expect(result.current.products).toEqual([]);
    expect(mocks.saveCatalogSnapshot).not.toHaveBeenCalled();
  });

  it("subscribes only while enabled and cleans up the channel", () => {
    const { rerender, unmount } = renderHook(
      ({ enabled }) => useAdminCatalogWorkspace({ enabled, shopId: "shop-1" }),
      { initialProps: { enabled: false } },
    );
    expect(mocks.subscribeToCatalogChanges).not.toHaveBeenCalled();

    rerender({ enabled: true });
    expect(mocks.subscribeToCatalogChanges).toHaveBeenCalledWith(
      "shop-1",
      expect.objectContaining({ onChange: expect.any(Function) }),
    );
    unmount();
    expect(mocks.unsubscribe).toHaveBeenCalledOnce();
  });
});
