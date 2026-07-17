import type {
  GachaBanner,
  GachaGameType,
  GachaPoolEntry,
} from "../types/gacha";
import { getGachaGameDescriptor } from "./gachaGames";

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

export function getGachaFeaturedItemLimit(gameType: GachaGameType): number {
  return getGachaGameDescriptor(gameType).displayLimitMax;
}

export function normalizeGachaDisplayLimit(
  value: unknown,
  gameType: GachaGameType,
): number {
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
  const rule = getGachaGameDescriptor(gameType).featuredRule;
  if (rule.kind === "primary-secondary") {
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
        rule.secondaryLimit,
        Math.max(0, limit - rule.primaryLimit),
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
