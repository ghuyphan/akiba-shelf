import { describe, expect, it } from "vitest";
import {
  capGachaFeaturedEntries,
  normalizeGachaDisplayLimit,
} from "../gachaLimits";
import type { GachaBanner, GachaPoolEntry } from "../../../types/gacha";

const banner = {
  id: "banner",
  display_limit: 5,
  kind: "character",
} as GachaBanner;
const entries = ["one", "two", "three"].map(
  (product_id, index): GachaPoolEntry =>
    ({
      banner_id: banner.id,
      product_id,
      active: true,
      featured: true,
      rarity: index === 0 ? 5 : 4,
      kind: "character",
    }) as GachaPoolEntry,
);

describe("gacha featured-item limits", () => {
  it("keeps one HSR primary and up to three secondary rate-ups", () => {
    const hsrEntries = [
      ...entries,
      { ...entries[0], product_id: "second-five" },
      { ...entries[1], product_id: "third-four" },
      { ...entries[1], product_id: "fourth-four" },
      { ...entries[1], product_id: "three-star", rarity: 3 as const },
      { ...entries[1], product_id: "wrong-kind", kind: "lightcone" as const },
    ];

    expect(normalizeGachaDisplayLimit(9, "hsr")).toBe(4);
    expect(
      capGachaFeaturedEntries(hsrEntries, [banner], "hsr").map(
        (entry) => entry.featured,
      ),
    ).toEqual([true, true, true, false, true, false, false, false]);
  });

  it("uses the HSR display limit for primary plus secondary slots", () => {
    expect(
      capGachaFeaturedEntries(
        entries,
        [{ ...banner, display_limit: 2 }],
        "hsr",
      ).map((entry) => entry.featured),
    ).toEqual([true, true, false]);
  });

  it("keeps Genshin banner limits between one and five", () => {
    expect(normalizeGachaDisplayLimit(0, "genshin")).toBe(1);
    expect(normalizeGachaDisplayLimit(3, "genshin")).toBe(3);
    expect(normalizeGachaDisplayLimit(9, "genshin")).toBe(5);
  });
});
