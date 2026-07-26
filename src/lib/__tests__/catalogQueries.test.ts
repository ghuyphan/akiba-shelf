import { describe, expect, it } from "vitest";
import {
  queryLocalCatalog,
  selectStorefrontFeaturedProducts,
} from "../catalogQueries";
import type { Product } from "../../types/catalog";

function product(overrides: Partial<Product>): Product {
  return {
    id: "product",
    name: "Product",
    collection: "Collection",
    description: "",
    price_vnd: 100,
    item_code: "ITEM",
    quantity_available: 1,
    category: "Prints",
    stock_status: "in_stock",
    stock_note: "",
    images: [],
    featured: false,
    sort_order: 0,
    active: true,
    ...overrides,
  };
}

describe("queryLocalCatalog", () => {
  const products = [
    product({ id: "b", name: "Beta", price_vnd: 200 }),
    product({ id: "a", name: "Alpha", price_vnd: 100, featured: true }),
    product({ id: "hidden", name: "Hidden", active: false }),
  ];

  it("filters inactive products and applies deterministic recommendation order", () => {
    expect(
      queryLocalCatalog(
        products,
        { category: "All", search: "", sort: "recommended" },
        0,
        24,
      ).products.map((item) => item.id),
    ).toEqual(["a", "b"]);
  });

  it("searches and paginates the cached catalog", () => {
    expect(
      queryLocalCatalog(
        products,
        { category: "Prints", search: "beta", sort: "price-desc" },
        0,
        1,
      ),
    ).toMatchObject({ products: [products[0]], hasMore: false });
  });
});

describe("selectStorefrontFeaturedProducts", () => {
  it("keeps only available featured products and applies the display cap", () => {
    const products = Array.from({ length: 10 }, (_, index) =>
      product({ id: `featured-${index}`, featured: true }),
    );
    products[1] = product({ id: "hidden", featured: true, active: false });
    products[2] = product({
      id: "sold-out",
      featured: true,
      quantity_available: 0,
    });

    expect(
      selectStorefrontFeaturedProducts(products).map((item) => item.id),
    ).toEqual([
      "featured-0",
      "featured-3",
      "featured-4",
      "featured-5",
      "featured-6",
      "featured-7",
      "featured-8",
      "featured-9",
    ]);
  });
});
