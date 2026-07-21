import { describe, expect, it } from "vitest";
import {
  capGachaFeaturedEntries,
  getGachaFeaturedComposition,
  isGachaFeaturedCompositionComplete,
  normalizeGachaDisplayLimit,
} from "../gachaLimits";
import type {
  GachaBanner,
  GachaItemKind,
  GachaPoolEntry,
  GachaRarity,
} from "../../../types/gacha";

function banner(kind: GachaItemKind): GachaBanner {
  return {
    id: `${kind}-banner`,
    kind,
    display_limit: kind === "character" ? 4 : 7,
  } as GachaBanner;
}

function entry(
  bannerId: string,
  productId: string,
  rarity: GachaRarity,
  kind: GachaItemKind,
): GachaPoolEntry {
  return {
    banner_id: bannerId,
    product_id: productId,
    active: true,
    featured: true,
    rarity,
    kind,
  } as GachaPoolEntry;
}

describe("gacha featured-item limits", () => {
  it("keeps the generic Genshin limit at five while normalizing kinds to four or seven", () => {
    expect(normalizeGachaDisplayLimit(9, "genshin")).toBe(5);
    expect(normalizeGachaDisplayLimit(2, "genshin", "character")).toBe(4);
    expect(normalizeGachaDisplayLimit(2, "genshin", "weapon")).toBe(7);
    expect(normalizeGachaDisplayLimit(9, "hsr", "character")).toBe(4);
    expect(normalizeGachaDisplayLimit(9, "hsr", "lightcone")).toBe(4);
  });

  it("caps Genshin character banners at one 5-star and three 4-star characters", () => {
    const characterBanner = banner("character");
    const entries = [
      entry(characterBanner.id, "five-1", 5, "character"),
      entry(characterBanner.id, "five-2", 5, "character"),
      entry(characterBanner.id, "four-1", 4, "character"),
      entry(characterBanner.id, "four-2", 4, "character"),
      entry(characterBanner.id, "four-3", 4, "character"),
      entry(characterBanner.id, "four-4", 4, "character"),
      entry(characterBanner.id, "wrong-kind", 4, "weapon"),
      entry(characterBanner.id, "three-star", 3, "character"),
    ];

    expect(
      capGachaFeaturedEntries(entries, [characterBanner], "genshin").map(
        ({ featured }) => featured,
      ),
    ).toEqual([true, false, true, true, true, false, false, false]);
  });

  it("caps Genshin weapon banners at two 5-star and five 4-star weapons", () => {
    const weaponBanner = banner("weapon");
    const entries = [
      ...Array.from({ length: 3 }, (_, index) =>
        entry(weaponBanner.id, `five-${index}`, 5, "weapon"),
      ),
      ...Array.from({ length: 6 }, (_, index) =>
        entry(weaponBanner.id, `four-${index}`, 4, "weapon"),
      ),
      entry(weaponBanner.id, "wrong-kind", 4, "character"),
    ];
    const capped = capGachaFeaturedEntries(entries, [weaponBanner], "genshin");

    expect(
      capped.filter((item) => item.featured && item.rarity === 5),
    ).toHaveLength(2);
    expect(
      capped.filter((item) => item.featured && item.rarity === 4),
    ).toHaveLength(5);
    expect(
      capped.find((item) => item.product_id === "wrong-kind")?.featured,
    ).toBe(false);
    expect(
      isGachaFeaturedCompositionComplete(capped, weaponBanner, "genshin"),
    ).toBe(true);
  });

  it("keeps HSR at one 5-star primary and up to three matching 4-star rate-ups", () => {
    const hsrBanner = banner("character");
    const entries = [
      entry(hsrBanner.id, "five-1", 5, "character"),
      entry(hsrBanner.id, "five-2", 5, "character"),
      ...Array.from({ length: 4 }, (_, index) =>
        entry(hsrBanner.id, `four-${index}`, 4, "character"),
      ),
      entry(hsrBanner.id, "wrong-kind", 4, "lightcone"),
    ];
    const capped = capGachaFeaturedEntries(entries, [hsrBanner], "hsr");
    const composition = getGachaFeaturedComposition(capped, hsrBanner);

    expect(composition).toMatchObject({
      fiveStarCount: 1,
      fourStarCount: 3,
      invalidCount: 0,
      totalCount: 4,
    });
  });

  it("treats partial Genshin drafts as incomplete without inventing slots", () => {
    const characterBanner = banner("character");
    const partial = [entry(characterBanner.id, "five-1", 5, "character")];

    expect(
      isGachaFeaturedCompositionComplete(partial, characterBanner, "genshin"),
    ).toBe(false);
  });
});
