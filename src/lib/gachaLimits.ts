import type {
  GachaBanner,
  GachaGameType,
  GachaPoolEntry,
} from "../types/gacha";

export const GACHA_FEATURED_ITEM_LIMITS: Record<GachaGameType, number> = {
  genshin: 5,
  hsr: 4,
};

export const HSR_PRIMARY_FEATURED_LIMIT = 1;
export const HSR_SECONDARY_FEATURED_LIMIT = 3;

export function matchesGachaBannerKind(
  entry: GachaPoolEntry,
  banner: GachaBanner,
): boolean {
  return banner.kind === "character"
    ? entry.kind === "character"
    : entry.kind !== "character";
}

export function getGachaFeaturedItemLimit(gameType: GachaGameType): number {
  return GACHA_FEATURED_ITEM_LIMITS[gameType];
}

export function normalizeGachaDisplayLimit(
  value: unknown,
  gameType: GachaGameType,
): number {
  const parsed = typeof value === "number" ? value : Number(value);
  const fallback = gameType === "hsr" ? 4 : 3;
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
  if (gameType === "hsr") {
    const allowed = new Set<GachaPoolEntry>();

    for (const banner of banners) {
      const limit = limits.get(banner.id) ?? 4;
      const candidates = entries.filter(
        (entry) =>
          entry.banner_id === banner.id &&
          entry.active &&
          entry.featured &&
          matchesGachaBannerKind(entry, banner),
      );
      const primary = candidates.find((entry) => entry.rarity === 5);
      if (primary) allowed.add(primary);

      const secondaryLimit = Math.min(
        HSR_SECONDARY_FEATURED_LIMIT,
        Math.max(0, limit - HSR_PRIMARY_FEATURED_LIMIT),
      );
      candidates
        .filter((entry) => entry.rarity === 4)
        .slice(0, secondaryLimit)
        .forEach((entry) => allowed.add(entry));
    }

    return entries.map((entry) =>
      !entry.active || !entry.featured || allowed.has(entry)
        ? entry
        : { ...entry, featured: false },
    );
  }

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
