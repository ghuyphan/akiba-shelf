import { describe, expect, it } from "vitest";
import type { Product } from "../../types/catalog";
import {
  calculateCartPricing,
  getProductDiscountPercent,
  getProductPrice,
  isProductOnSale,
} from "../pricing";

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

  it("applies a configurable repeating offer to the cheapest eligible items", () => {
    const pricing = calculateCartPricing(
      [
        { product: { ...product, id: "poster-a", price_vnd: 40_000 }, quantity: 2 },
        { product: { ...product, id: "poster-b", price_vnd: 25_000 }, quantity: 0, reward_quantity: 1 },
        { product: { ...product, id: "extra", price_vnd: 10_000 }, quantity: 1 },
      ],
      { enabled: true, buy_quantity: 2, free_quantity: 1, repeatable: true, qualifying_product_ids: ["poster-a"], reward_product_ids: ["poster-b"] },
    );

    expect(pricing.eligibleQuantity).toBe(2);
    expect(pricing.freeQuantity).toBe(1);
    expect(pricing.discountAmount).toBe(25_000);
    expect(pricing.total).toBe(90_000);
    expect(pricing.lines.find((line) => line.productId === "poster-b")?.freeQuantity).toBe(1);
  });

  it("applies a non-repeating offer only once", () => {
    const pricing = calculateCartPricing(
      [{ product, quantity: 8, reward_quantity: 1 }],
      { enabled: true, buy_quantity: 3, free_quantity: 1, repeatable: false, qualifying_product_ids: [product.id], reward_product_ids: [product.id] },
    );

    expect(pricing.freeQuantity).toBe(1);
    expect(pricing.discountAmount).toBe(40_000);
    expect(pricing.total).toBe(320_000);
  });

  it("does not apply eligible flags while the promotion is disabled", () => {
    const pricing = calculateCartPricing(
      [{ product, quantity: 4 }],
      { enabled: false, buy_quantity: 3, free_quantity: 1, repeatable: true, qualifying_product_ids: [product.id], reward_product_ids: [product.id] },
    );
    expect(pricing.discountAmount).toBe(0);
    expect(pricing.total).toBe(160_000);
  });
});
