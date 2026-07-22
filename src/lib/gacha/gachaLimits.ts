import type {
  GachaBanner,
  GachaGameType,
  GachaItemKind,
  GachaPoolEntry,
} from "../../types/gacha";
import {
  getGachaBannerFeaturedRule,
  getGachaGameDescriptor,
} from "./gachaGames";

export const GACHA_FEATURED_ITEM_LIMITS: Record<GachaGameType, number> = {
  genshin: getGachaGameDescriptor("genshin").displayLimitMax,
  hsr: getGachaGameDescriptor("hsr").displayLimitMax,
};

export function matchesGachaBannerKind(
  entry: GachaPoolEntry,
  banner: GachaBanner,
): boolean {
  return banner.kind === "character"
    ? entry.kind === "character"
    : entry.kind !== "character";
}

export function getGachaFeaturedItemLimit(
  gameType: GachaGameType,
  bannerKind?: GachaItemKind,
): number {
  return bannerKind
    ? getGachaBannerFeaturedRule(gameType, bannerKind).displayLimit
    : getGachaGameDescriptor(gameType).displayLimitMax;
}

export function normalizeGachaDisplayLimit(
  value: unknown,
  gameType: GachaGameType,
  bannerKind?: GachaItemKind,
): number {
  if (bannerKind)
    return getGachaBannerFeaturedRule(gameType, bannerKind).displayLimit;
  const parsed = typeof value === "number" ? value : Number(value);
  const fallback = getGachaGameDescriptor(gameType).defaults.displayLimit;
  const limit = Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
  return Math.min(getGachaFeaturedItemLimit(gameType), Math.max(1, limit));
}

export function normalizeGachaBanners(
  banners: GachaBanner[],
  gameType: GachaGameType,
): GachaBanner[] {
  return banners.map((banner) => ({
    ...banner,
    display_limit: normalizeGachaDisplayLimit(
      banner.display_limit,
      gameType,
      banner.kind,
    ),
  }));
}

export type GachaFeaturedComposition = {
  fiveStarCount: number;
  fourStarCount: number;
  invalidCount: number;
  totalCount: number;
};

export function getGachaFeaturedComposition(
  entries: GachaPoolEntry[],
  banner: GachaBanner,
): GachaFeaturedComposition {
  const featured = entries.filter(
    (entry) => entry.banner_id === banner.id && entry.active && entry.featured,
  );
  const valid = featured.filter((entry) =>
    matchesGachaBannerKind(entry, banner),
  );
  const fiveStarCount = valid.filter((entry) => entry.rarity === 5).length;
  const fourStarCount = valid.filter((entry) => entry.rarity === 4).length;
  return {
    fiveStarCount,
    fourStarCount,
    invalidCount: featured.length - fiveStarCount - fourStarCount,
    totalCount: featured.length,
  };
}

export function isGachaFeaturedCompositionComplete(
  entries: GachaPoolEntry[],
  banner: GachaBanner,
  gameType: GachaGameType,
): boolean {
  const rule = getGachaBannerFeaturedRule(gameType, banner.kind);
  const composition = getGachaFeaturedComposition(entries, banner);
  return (
    composition.invalidCount === 0 &&
    composition.fiveStarCount === rule.fiveStarLimit &&
    composition.fourStarCount === rule.fourStarLimit
  );
}

export function hasGachaBannerRarities(
  entries: GachaPoolEntry[],
  banner: GachaBanner,
  featured: boolean | null = null,
): boolean {
  const rarities = new Set(
    entries
      .filter(
        (entry) =>
          entry.banner_id === banner.id &&
          entry.active &&
          (featured === null || entry.featured === featured),
      )
      .map((entry) => entry.rarity),
  );
  return rarities.has(4) && rarities.has(5);
}

export type RecommendedGachaEntry = {
  productId: string;
  rarity: 4 | 5;
  featured: boolean;
};

export function getRecommendedGachaEntryPlan(
  productIds: string[],
  banner: GachaBanner,
  gameType: GachaGameType,
  featuredRate: number,
): { entries: RecommendedGachaEntry[]; canEnable: boolean } {
  const rule = getGachaBannerFeaturedRule(gameType, banner.kind);
  if (productIds.length < rule.displayLimit) {
    return { entries: [], canEnable: false };
  }

  const entries = productIds
    .slice(0, rule.displayLimit)
    .map((productId, index) => ({
      productId,
      rarity: (index < rule.fiveStarLimit ? 5 : 4) as 4 | 5,
      featured: true,
    }));
  const needsLossCandidates = featuredRate < 100;
  if (needsLossCandidates && productIds.length >= rule.displayLimit + 2) {
    entries.push(
      { productId: productIds[rule.displayLimit], rarity: 5, featured: false },
      {
        productId: productIds[rule.displayLimit + 1],
        rarity: 4,
        featured: false,
      },
    );
  }

  return {
    entries,
    canEnable: !needsLossCandidates || entries.length === rule.displayLimit + 2,
  };
}

export function capGachaFeaturedEntries(
  entries: GachaPoolEntry[],
  banners: GachaBanner[],
  gameType: GachaGameType,
): GachaPoolEntry[] {
  const allowed = new Set<GachaPoolEntry>();

  for (const banner of banners) {
    const rule = getGachaBannerFeaturedRule(gameType, banner.kind);
    const candidates = entries.filter(
      (entry) =>
        entry.banner_id === banner.id &&
        entry.active &&
        entry.featured &&
        matchesGachaBannerKind(entry, banner),
    );
    candidates
      .filter((entry) => entry.rarity === 5)
      .slice(0, rule.fiveStarLimit)
      .forEach((entry) => allowed.add(entry));
    candidates
      .filter((entry) => entry.rarity === 4)
      .slice(0, rule.fourStarLimit)
      .forEach((entry) => allowed.add(entry));
  }

  return entries.map((entry) =>
    !entry.active || !entry.featured || allowed.has(entry)
      ? entry
      : { ...entry, featured: false },
  );
}
