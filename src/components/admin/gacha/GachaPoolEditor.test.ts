import { describe, expect, it } from "vitest";
import { getGachaGameDescriptor } from "../../../lib/gacha/gachaGames";
import type { GachaPoolEntry } from "../../../types/gacha";
import { compareGachaPoolItems } from "./GachaPoolEditor";

function entry(
  productId: string,
  changes: Partial<GachaPoolEntry>,
): GachaPoolEntry {
  return {
    shop_id: "shop-id",
    banner_id: "banner-id",
    product_id: productId,
    kind: "character",
    element: "anemo",
    weapon_type: "sword",
    rarity: 4,
    weight: 100,
    featured: false,
    active: true,
    ...changes,
  };
}

function sortedIds(
  entries: GachaPoolEntry[],
  gameType: "genshin" | "hsr",
  inactiveProducts = new Set<string>(),
) {
  const descriptor = getGachaGameDescriptor(gameType);
  return entries
    .map((item, catalogIndex) => ({
      entry: item,
      productActive: !inactiveProducts.has(item.product_id),
      catalogIndex,
    }))
    .sort((left, right) =>
      compareGachaPoolItems(left, right, descriptor),
    )
    .map(({ entry: item }) => item.product_id);
}

describe("gacha pool display order", () => {
  it("groups Genshin prizes by promotion, rarity, and native element order", () => {
    const entries = [
      entry("standard-four", { element: "anemo" }),
      entry("featured-cryo", { element: "cryo", featured: true }),
      entry("standard-five", { element: "geo", rarity: 5 }),
      entry("featured-five", {
        element: "dendro",
        rarity: 5,
        featured: true,
      }),
      entry("featured-pyro", { element: "pyro", featured: true }),
      entry("inactive-featured-five", {
        element: "hydro",
        rarity: 5,
        featured: true,
      }),
    ];

    expect(
      sortedIds(entries, "genshin", new Set(["inactive-featured-five"])),
    ).toEqual([
      "featured-five",
      "featured-pyro",
      "featured-cryo",
      "standard-five",
      "standard-four",
      "inactive-featured-five",
    ]);
  });

  it("uses HSR combat-type order inside matching groups", () => {
    const entries = [
      entry("featured-wind", { element: "wind", featured: true }),
      entry("standard-imaginary", { element: "imaginary", rarity: 5 }),
      entry("featured-fire", { element: "fire", featured: true }),
      entry("standard-physical", { element: "physical", rarity: 5 }),
    ];

    expect(sortedIds(entries, "hsr")).toEqual([
      "featured-fire",
      "featured-wind",
      "standard-physical",
      "standard-imaginary",
    ]);
  });
});
