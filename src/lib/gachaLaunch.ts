import { z } from "zod";
import { getGachaCatalog, getPublicBoothSettings, getPublicShop } from "./api";
import type { BoothSettings, Shop } from "../types/catalog";
import type { GachaCatalog, GachaGameType } from "../types/gacha";

/** localStorage key prefix for the catalog handed to the wish simulator. */
export const GACHA_CONFIG_STORAGE_PREFIX = "matsuri-gacha-config:";
/** localStorage key prefix for the admin designer's unsaved preview catalog. */
export const GACHA_PREVIEW_CONFIG_STORAGE_PREFIX =
  "matsuri-gacha-preview-config:";
/** postMessage type the simulator iframe sends to close the gacha host. */
export const GACHA_CLOSE_MESSAGE_TYPE = "matsuri-gacha-close";

export type GachaLaunchData = {
  shop: Shop;
  booth: BoothSettings;
  catalog: GachaCatalog;
};

type GachaLaunchSeed = {
  shop?: Shop | null;
  booth?: BoothSettings;
};

type CachedLaunch = {
  expiresAt: number;
  promise: Promise<GachaLaunchData>;
};

const CACHE_TTL_MS = 60_000;
const launchCache = new Map<string, CachedLaunch>();
const prefetchedSimulators = new Set<GachaGameType>();

function normalizedSlug(shopSlug: string) {
  return shopSlug.trim().toLowerCase();
}

export function getGachaSimulatorPath(gameType: GachaGameType) {
  const simulator = gameType === "hsr" ? "hsr-simulator" : "gacha-simulator";
  return `${import.meta.env.BASE_URL}${simulator}/`;
}

function prefetchSimulatorDocument(gameType: GachaGameType) {
  if (typeof document === "undefined" || prefetchedSimulators.has(gameType)) return;
  prefetchedSimulators.add(gameType);
  const link = document.createElement("link");
  link.rel = "prefetch";
  link.href = getGachaSimulatorPath(gameType);
  document.head.append(link);
}

export function loadGachaLaunch(
  shopSlug: string,
  seed: GachaLaunchSeed = {},
): Promise<GachaLaunchData> {
  const slug = normalizedSlug(shopSlug);
  const cached = launchCache.get(slug);
  if (cached && cached.expiresAt > Date.now()) return cached.promise;

  const promise = (async () => {
    const shop = seed.shop?.slug === slug ? seed.shop : await getPublicShop(slug);
    if (!shop) throw new Error("Shop not found.");
    const sourceShopId = shop.catalog_source_shop_id ?? shop.id;
    const boothPromise =
      seed.booth?.shop_id === sourceShopId
        ? Promise.resolve(seed.booth)
        : getPublicBoothSettings(sourceShopId);
    const [catalog, booth] = await Promise.all([
      getGachaCatalog(sourceShopId),
      boothPromise,
    ]);
    return { shop, booth, catalog };
  })();

  launchCache.set(slug, {
    expiresAt: Date.now() + CACHE_TTL_MS,
    promise,
  });
  void promise.catch(() => {
    if (launchCache.get(slug)?.promise === promise) launchCache.delete(slug);
  });
  return promise;
}

export async function prepareGachaLaunch(
  shopSlug: string,
  seed: GachaLaunchSeed = {},
  prefetchSimulator = true,
) {
  const launch = await loadGachaLaunch(shopSlug, seed);
  if (prefetchSimulator) {
    prefetchSimulatorDocument(
      launch.catalog.settings?.game_type === "hsr" ? "hsr" : "genshin",
    );
  }
}

export function clearGachaLaunchCache() {
  launchCache.clear();
}

const gachaItemKindSchema = z.enum(["character", "weapon", "lightcone"]);

const gachaPreviewSettingsSchema = z
  .object({
    shop_id: z.string(),
    enabled: z.boolean(),
    game_type: z.enum(["genshin", "hsr"]),
    title: z.string(),
    description: z.string(),
    rare_pity: z.number(),
    legendary_pity: z.number(),
    lightcone_legendary_pity: z.number(),
  })
  .passthrough();

const gachaPreviewBannerSchema = z
  .object({
    id: z.string(),
    shop_id: z.string(),
    name: z.string(),
    description: z.string(),
    kind: gachaItemKindSchema,
    theme: z.string(),
    display_limit: z.number(),
    sort_order: z.number(),
    active: z.boolean(),
  })
  .passthrough();

const gachaPreviewEntrySchema = z
  .object({
    shop_id: z.string(),
    banner_id: z.string(),
    product_id: z.string(),
    kind: gachaItemKindSchema,
    element: z.string(),
    weapon_type: z.string(),
    rarity: z.number(),
    weight: z.number(),
    featured: z.boolean(),
    active: z.boolean(),
    product: z.object({ id: z.string(), name: z.string() }).passthrough(),
  })
  .passthrough();

const gachaPreviewCatalogSchema = z
  .object({
    settings: gachaPreviewSettingsSchema.nullable(),
    banners: z.array(gachaPreviewBannerSchema),
    entries: z.array(gachaPreviewEntrySchema),
  })
  .passthrough();

/**
 * Reads and structurally validates a preview catalog written by the admin
 * designer. Returns null when the payload is missing, malformed JSON, or does
 * not match the expected catalog shape, so callers can fall back to the
 * server-published catalog instead of trusting a blind cast.
 */
export function parseGachaPreviewConfig(raw: string | null): GachaCatalog | null {
  if (!raw) return null;
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return null;
  }
  const parsed = gachaPreviewCatalogSchema.safeParse(json);
  return parsed.success ? (parsed.data as GachaCatalog) : null;
}
