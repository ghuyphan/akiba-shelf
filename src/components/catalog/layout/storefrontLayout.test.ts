import { describe, expect, it } from "vitest";
import {
  DEFAULT_STOREFRONT_ORDER,
  getStorefrontColumnPosition,
  normalizeStorefrontOrder,
  partitionStorefrontOrder,
} from "./storefrontLayout";

describe("storefront layout helpers", () => {
  it("keeps a complete saved order and rejects incomplete layouts", () => {
    const saved = [
      "booth",
      "featured",
      "cart",
      "controls",
      "products",
    ] as const;
    expect(normalizeStorefrontOrder([...saved])).toEqual(saved);
    expect(
      normalizeStorefrontOrder([
        "booth",
        "featured",
        "cart",
        "controls",
        "controls",
      ]),
    ).toBe(DEFAULT_STOREFRONT_ORDER);
  });

  it("partitions modules and preserves their relative column position", () => {
    const order = normalizeStorefrontOrder([
      "booth",
      "featured",
      "cart",
      "controls",
      "products",
    ]);
    const groups = partitionStorefrontOrder(order);
    expect(groups).toEqual({
      hero: ["booth", "featured"],
      main: ["controls", "products"],
      side: ["cart"],
    });
    expect(getStorefrontColumnPosition(order, groups.main)).toBe(3.5);
    expect(getStorefrontColumnPosition(order, groups.side, -0.01)).toBe(1.99);
  });
});
