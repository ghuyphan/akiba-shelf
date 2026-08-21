import { describe, expect, it } from "vitest";
import {
  DEFAULT_STOREFRONT_ORDER,
  getStorefrontColumnPosition,
  normalizeStorefrontOrder,
  partitionStorefrontOrder,
  resolveStorefrontLayout,
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

  it("resolves adaptive layouts for split heroes and custom sidebar placements", () => {
    // Split hero with left-side cart
    const leftCartLayout = resolveStorefrontLayout([
      "featured",
      "booth",
      "cart",
      "controls",
      "products",
    ]);
    expect(leftCartLayout.heroStyle).toBe("split");
    expect(leftCartLayout.hero).toEqual(["featured", "booth"]);
    expect(leftCartLayout.contentColumns[0].key).toBe("side");
    expect(leftCartLayout.contentColumns[1].key).toBe("main");

    // Full featured hero with right booth & cart
    const fullHeroLayout = resolveStorefrontLayout([
      "featured",
      "controls",
      "products",
      "booth",
      "cart",
    ]);
    expect(fullHeroLayout.heroStyle).toBe("full_featured");
    expect(fullHeroLayout.hero).toEqual(["featured"]);
    expect(fullHeroLayout.contentColumns[0].key).toBe("main");
    expect(fullHeroLayout.contentColumns[0].sections).toEqual([
      "controls",
      "products",
    ]);
    expect(fullHeroLayout.contentColumns[1].key).toBe("side");
    expect(fullHeroLayout.contentColumns[1].sections).toEqual(["booth", "cart"]);
  });
});
