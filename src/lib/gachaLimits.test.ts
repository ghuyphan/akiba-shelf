import { describe, expect, it } from "vitest";
import {
  capGachaFeaturedEntries,
  normalizeGachaDisplayLimit,
} from "./gachaLimits";
import type { GachaBanner, GachaPoolEntry } from "../types/gacha";

const banner = { id: "banner", display_limit: 5 } as GachaBanner;
const entries = ["one", "two", "three"].map(
  (product_id): GachaPoolEntry =>
    ({
      banner_id: banner.id,
      product_id,
      active: true,
      featured: true,
    }) as GachaPoolEntry,
);

describe("gacha featured-item limits", () => {
  it("always limits HSR banners to one featured item", () => {
    expect(normalizeGachaDisplayLimit(5, "hsr")).toBe(1);
    expect(
      capGachaFeaturedEntries(entries, [banner], "hsr").map(
        (entry) => entry.featured,
      ),
    ).toEqual([true, false, false]);
  });

  it("keeps Genshin banner limits between one and five", () => {
    expect(normalizeGachaDisplayLimit(0, "genshin")).toBe(1);
    expect(normalizeGachaDisplayLimit(3, "genshin")).toBe(3);
    expect(normalizeGachaDisplayLimit(9, "genshin")).toBe(5);
  });
});
