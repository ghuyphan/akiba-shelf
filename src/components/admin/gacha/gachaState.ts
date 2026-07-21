import { safePublicUrl } from "../../../lib/branding";
import { getGachaGameDescriptor } from "../../../lib/gacha/gachaGames";
import {
  capGachaFeaturedEntries,
  normalizeGachaBanners,
  normalizeGachaDisplayLimit,
} from "../../../lib/gacha/gachaLimits";
import type { Product } from "../../../types/catalog";
import {
  defaultGachaBanner,
  defaultGachaSettings,
  type GachaBanner,
  type GachaGameConfiguration,
  type GachaGameType,
  type GachaItemKind,
  type GachaPoolEntry,
  type GachaSettings,
} from "../../../types/gacha";

export interface GachaState {
  settings: GachaSettings;
  banners: GachaBanner[];
  entries: GachaPoolEntry[];
  selectedBannerId: string;
}

export type GachaStatesByGame = Partial<Record<GachaGameType, GachaState>>;

export function newEntry(
  shopId: string,
  bannerId: string,
  productId: string,
  kind: GachaItemKind,
  gameType: GachaGameType,
): GachaPoolEntry {
  const { defaults } = getGachaGameDescriptor(gameType);
  return {
    shop_id: shopId,
    banner_id: bannerId,
    product_id: productId,
    kind,
    element: defaults.entryElement,
    weapon_type: defaults.entryWeaponType,
    rarity: 3,
    weight: 100,
    featured: false,
    active: true,
  };
}

export function productImage(product: Product) {
  return safePublicUrl(
    product.image_variants?.[0]?.thumbnail ?? product.images[0] ?? "",
  );
}

/**
 * A merch item may only live in one banner of a game. Keep the first
 * occurrence (in banner order) and drop later duplicates.
 */
export function dedupeGachaEntriesByProduct(
  entries: GachaPoolEntry[],
): GachaPoolEntry[] {
  const seen = new Set<string>();
  return entries.filter((entry) => {
    if (seen.has(entry.product_id)) return false;
    seen.add(entry.product_id);
    return true;
  });
}

export function createGameState(
  shopId: string,
  gameType: GachaGameType,
  configuration?: GachaGameConfiguration,
): GachaState {
  const { defaults } = getGachaGameDescriptor(gameType);
  const fallbackBanner = {
    ...defaultGachaBanner(shopId),
    name: defaults.bannerName,
    theme: defaults.bannerTheme,
    display_limit: normalizeGachaDisplayLimit(
      defaults.displayLimit,
      gameType,
    ),
  };
  const settings = configuration?.settings ?? {
    ...defaultGachaSettings(shopId),
    game_type: gameType,
    title: defaults.title,
    description: defaults.description,
    legendary_pity: defaults.legendaryPity,
    legendary_soft_pity: defaults.legendaryPity - 1,
  };
  const banners = normalizeGachaBanners(
    configuration?.banners.length ? configuration.banners : [fallbackBanner],
    gameType,
  );
  const entries = dedupeGachaEntriesByProduct(
    capGachaFeaturedEntries(configuration?.entries ?? [], banners, gameType),
  );
  return {
    settings: { ...settings, game_type: gameType },
    banners,
    entries,
    selectedBannerId: banners[0]?.id ?? "",
  };
}

export function persistedGameState(state: GachaState): GachaGameConfiguration {
  const gameType = state.settings.game_type;
  const banners = normalizeGachaBanners(state.banners, gameType);
  return {
    settings: state.settings,
    banners,
    entries: capGachaFeaturedEntries(state.entries, banners, gameType),
  };
}
