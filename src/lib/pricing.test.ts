import { describe, expect, it } from "vitest";
import type { Product } from "../types/catalog";
import {
  getProductDiscountPercent,
  getProductPrice,
  isProductOnSale,
} from "./pricing";

const product = {
  id: "price-test",
  name: "Price test",
  collection: "",
  description: "",
  price_vnd: 40_000,
  item_code: "PRICE",
  quantity_available: 1,
  category: "Test",
  stock_status: "limited",
  stock_note: "Limited",
  images: [],
  featured: false,
  sort_order: 1,
  active: true,
} satisfies Product;

describe("product pricing", () => {
  it("uses the regular price when no sale exists", () => {
    expect(getProductPrice(product)).toBe(40_000);
    expect(isProductOnSale(product)).toBe(false);
  });

  it("uses the sale price and calculates the discount", () => {
    const sale = { ...product, sale_price_vnd: 32_000, effective_price_vnd: 32_000 };
    expect(getProductPrice(sale)).toBe(32_000);
    expect(getProductDiscountPercent(sale)).toBe(20);
  });
});
