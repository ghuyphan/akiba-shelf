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

  it("partitions modules correctly for full_hero preset", () => {
    const order = normalizeStorefrontOrder([
      "featured",
      "booth",
      "controls",
      "products",
      "cart",
    ]);
    const groups = partitionStorefrontOrder(order, "full_hero");
    expect(groups).toEqual({
      hero: ["featured"],
      main: ["booth", "controls", "products"],
      side: ["cart"],
    });
  });

  it("partitions modules correctly for sidebar_booth preset", () => {
    const order = normalizeStorefrontOrder([
      "featured",
      "booth",
      "controls",
      "products",
      "cart",
    ]);
    const groups = partitionStorefrontOrder(order, "sidebar_booth");
    expect(groups).toEqual({
      hero: [],
      main: ["featured", "controls", "products"],
      side: ["booth", "cart"],
    });
  });

  it("partitions modules correctly for stacked preset", () => {
    const order = normalizeStorefrontOrder([
      "featured",
      "booth",
      "controls",
      "products",
      "cart",
    ]);
    const groups = partitionStorefrontOrder(order, "stacked");
    expect(groups).toEqual({
      hero: ["featured", "booth", "controls", "products", "cart"],
      main: [],
      side: [],
    });
  });

  it("filters out hidden sections across all presets", () => {
    const order = normalizeStorefrontOrder([
      "featured",
      "booth",
      "controls",
      "products",
      "cart",
    ]);
    const groups = partitionStorefrontOrder(order, "split", [
      "featured",
      "cart",
    ]);
    expect(groups).toEqual({
      hero: ["booth"],
      main: ["controls", "products"],
      side: [],
    });
  });
});
