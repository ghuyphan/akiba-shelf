import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Product } from "../types/catalog";

const storedCart = vi.hoisted(() => ({ current: [] as unknown[] }));
vi.mock("../lib/offline/offline", () => ({
  loadCart: vi.fn(() => storedCart.current),
  saveCart: vi.fn((cart: unknown[]) => {
    storedCart.current = cart;
  }),
}));

import { usePersistentCart } from "./usePersistentCart";

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: "product-1",
    name: "Acrylic stand",
    collection: "",
    description: "",
    price_vnd: 100_000,
    item_code: "STAND-1",
    quantity_available: 5,
    category: "Stands",
    stock_status: "in_stock",
    stock_note: "",
    images: [],
    featured: false,
    sort_order: 0,
    active: true,
    ...overrides,
  };
}

describe("usePersistentCart", () => {
  beforeEach(() => {
    storedCart.current = [];
  });

  it("reports authoritative stock and price reconciliation", () => {
    const { result } = renderHook(() => usePersistentCart("test-shop"));
    act(() => {
      result.current.setCart([
        { product: product(), quantity: 4 },
        {
          product: product({ id: "product-2", item_code: "STAND-2" }),
          quantity: 1,
        },
      ]);
    });

    act(() => {
      result.current.reconcileCart(
        [product({ quantity_available: 2, price_vnd: 120_000 })],
        ["product-1", "product-2"],
      );
    });

    expect(result.current.cart).toHaveLength(1);
    expect(result.current.cart[0]).toMatchObject({ quantity: 2 });
    expect(result.current.reconciliationNotice).toEqual({
      removed: 1,
      quantityAdjusted: 1,
      priceChanged: 1,
    });
  });
});
