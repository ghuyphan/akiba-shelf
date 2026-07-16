import type {
  GachaBanner,
  GachaGameType,
  GachaPoolEntry,
} from "../types/gacha";

export const GACHA_FEATURED_ITEM_LIMITS: Record<GachaGameType, number> = {
  genshin: 5,
  hsr: 1,
};

export function getGachaFeaturedItemLimit(gameType: GachaGameType): number {
  return GACHA_FEATURED_ITEM_LIMITS[gameType];
}

export function normalizeGachaDisplayLimit(
  value: unknown,
  gameType: GachaGameType,
): number {
  const parsed = typeof value === "number" ? value : Number(value);
  const fallback = gameType === "hsr" ? 1 : 3;
  const limit = Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
  return Math.min(getGachaFeaturedItemLimit(gameType), Math.max(1, limit));
}

export function normalizeGachaBanners(
  banners: GachaBanner[],
  gameType: GachaGameType,
): GachaBanner[] {
  return banners.map((banner) => ({
    ...banner,
    display_limit: normalizeGachaDisplayLimit(banner.display_limit, gameType),
  }));
}

export function capGachaFeaturedEntries(
  entries: GachaPoolEntry[],
  banners: GachaBanner[],
  gameType: GachaGameType,
): GachaPoolEntry[] {
  const limits = new Map(
    banners.map((banner) => [
      banner.id,
      normalizeGachaDisplayLimit(banner.display_limit, gameType),
    ]),
  );
  const featuredSeen = new Map<string, number>();

  return entries.map((entry) => {
    if (!entry.active || !entry.featured) return entry;
    const seen = featuredSeen.get(entry.banner_id) ?? 0;
    featuredSeen.set(entry.banner_id, seen + 1);
    return seen < (limits.get(entry.banner_id) ?? 1)
      ? entry
      : { ...entry, featured: false };
  });
}
