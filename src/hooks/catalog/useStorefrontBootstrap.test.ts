import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { defaultBooth } from "../../lib/constants";
import type { Product } from "../../types/catalog";

const mocks = vi.hoisted(() => ({
  getPublicFeaturedProducts: vi.fn(),
  getPublicProductCategories: vi.fn(),
}));

vi.mock("../../lib/api/products", () => ({
  getPublicFeaturedProducts: mocks.getPublicFeaturedProducts,
  getPublicProductCategories: mocks.getPublicProductCategories,
}));

import { useStorefrontBootstrap } from "./useStorefrontBootstrap";

const noProducts: Product[] = [];
const noCategories: string[] = [];

function product(id: string, featured = true): Product {
  return {
    id,
    name: id,
    collection: "Collection",
    description: "",
    price_vnd: 1000,
    item_code: id,
    quantity_available: 1,
    category: "Prints",
    stock_status: "in_stock",
    stock_note: "In stock",
    images: [],
    featured,
    sort_order: 0,
    active: true,
  };
}

describe("useStorefrontBootstrap", () => {
  beforeEach(() => {
    mocks.getPublicProductCategories.mockResolvedValue([]);
  });

  it("normalizes a broad featured response before exposing it", async () => {
    mocks.getPublicFeaturedProducts.mockResolvedValue([
      product("regular", false),
      ...Array.from({ length: 9 }, (_, index) => product(`featured-${index}`)),
    ]);
    const { result } = renderHook(() =>
      useStorefrontBootstrap(
        "shop-1",
        "shop",
        false,
        defaultBooth,
        noProducts,
        undefined,
        undefined,
        noCategories,
        undefined,
      ),
    );

    await act(async () => result.current.refreshProductMetadata());

    expect(result.current.featuredProducts.map(({ id }) => id)).toEqual(
      Array.from({ length: 8 }, (_, index) => `featured-${index}`),
    );
  });
});
