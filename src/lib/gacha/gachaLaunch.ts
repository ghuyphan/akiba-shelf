import { z } from "zod";
import { getGachaCatalogs } from "../api/gacha";
import { getPublicBoothSettings } from "../api/settings";
import { getPublicShop } from "../api/shops";
import type { BoothSettings, Shop } from "../../types/catalog";
import type {
  GachaCatalog,
  GachaCatalogsByGame,
  GachaGameType,
} from "../../types/gacha";
import { getGachaFallback3StarEntries } from "./gachaGames";
import { boothSettingsSchema, shopSchema } from "../schemas";

/** localStorage key prefix for the catalog handed to the wish simulator. */
export const GACHA_CONFIG_STORAGE_PREFIX = "matsuri-gacha-config:";
/** localStorage key prefix for the admin designer's unsaved preview catalog. */
export const GACHA_PREVIEW_CONFIG_STORAGE_PREFIX =
  "matsuri-gacha-preview-config:";
/** postMessage type the simulator iframe sends to close the gacha host. */
export const GACHA_CLOSE_MESSAGE_TYPE = "matsuri-gacha-close";
export const GACHA_OFFLINE_REQUEST_MESSAGE_TYPE =
  "matsuri-gacha-offline-request";
export const GACHA_OFFLINE_STATUS_MESSAGE_TYPE = "matsuri-gacha-offline-status";
export const GACHA_OFFLINE_PROGRESS_MESSAGE_TYPE =
  "matsuri-gacha-offline-progress";

export type GachaLaunchData = {
  shop: Shop;
  booth: BoothSettings;
  catalogs: GachaCatalogsByGame;
};

export function isGachaBannerRunning(
  banner: Pick<
    GachaCatalog["banners"][number],
    "active" | "starts_at" | "ends_at"
  >,
  now = Date.now(),
) {
  if (!banner.active) return false;
  const startsAt = banner.starts_at ? Date.parse(banner.starts_at) : null;
  const endsAt = banner.ends_at ? Date.parse(banner.ends_at) : null;
  return (
    (startsAt === null || Number.isNaN(startsAt) || startsAt <= now) &&
    (endsAt === null || Number.isNaN(endsAt) || endsAt > now)
  );
}

export function runningGachaCatalog(
  catalog: GachaCatalog,
  now = Date.now(),
): GachaCatalog {
  const banners = catalog.banners.filter((banner) =>
    isGachaBannerRunning(banner, now),
  );
  const bannerIds = new Set(banners.map((banner) => banner.id));

  // Include active banner 4★/5★ entries + all 3★ shared pool entries
  const activeEntries = catalog.entries.filter(
    (entry) => bannerIds.has(entry.banner_id) || entry.rarity === 3,
  );

  const gameType: GachaGameType = catalog.settings?.game_type ?? "genshin";
  const shopId = catalog.settings?.shop_id ?? "";
  const finalEntries = [...activeEntries];

  // Inject default booth souvenirs if no 3-star entries exist in the catalog
  const hasAny3Star = finalEntries.some((entry) => entry.rarity === 3);
  if (!hasAny3Star && banners.length > 0) {
    const fallback3Star = getGachaFallback3StarEntries(
      shopId,
      banners[0].id,
      gameType,
    );
    finalEntries.push(...fallback3Star);
  }

  return {
    ...catalog,
    banners,
    entries: finalEntries,
  };
}

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
  if (typeof document === "undefined" || prefetchedSimulators.has(gameType))
    return;
  prefetchedSimulators.add(gameType);
  const link = document.createElement("link");
  link.rel = "prefetch";
  link.href = getGachaSimulatorPath(gameType);
  document.head.append(link);
}

async function fetchGachaLaunch(slug: string, seed: GachaLaunchSeed) {
  const shop = seed.shop?.slug === slug ? seed.shop : await getPublicShop(slug);
  if (!shop) throw new Error("Shop not found.");
  const sourceShopId = shop.catalog_source_shop_id ?? shop.id;
  const boothPromise =
    seed.booth?.shop_id === sourceShopId
      ? Promise.resolve(seed.booth)
      : getPublicBoothSettings(sourceShopId);
  const [catalogs, booth] = await Promise.all([
    getGachaCatalogs(sourceShopId),
    boothPromise,
  ]);
  const launch = { shop, booth, catalogs };
  saveStoredGachaLaunch(slug, launch);
  return launch;
}

export async function refreshGachaLaunch(
  shopSlug: string,
  seed: GachaLaunchSeed = {},
) {
  const slug = normalizedSlug(shopSlug);
  const fresh = await fetchGachaLaunch(slug, seed);
  launchCache.set(slug, {
    expiresAt: Date.now() + CACHE_TTL_MS,
    promise: Promise.resolve(fresh),
  });
  return fresh;
}

export function hasStoredGachaLaunch(shopSlug: string) {
  return Boolean(loadStoredGachaLaunch(normalizedSlug(shopSlug)));
}

export function loadGachaLaunch(
  shopSlug: string,
  seed: GachaLaunchSeed = {},
): Promise<GachaLaunchData> {
  const slug = normalizedSlug(shopSlug);
  const cached = launchCache.get(slug);
  if (cached && cached.expiresAt > Date.now()) return cached.promise;
  const storedLaunch = loadStoredGachaLaunch(slug);

  if (storedLaunch) {
    const promise = Promise.resolve(storedLaunch);
    launchCache.set(slug, { expiresAt: Date.now() + CACHE_TTL_MS, promise });
    return promise;
  }

  const networkPromise = fetchGachaLaunch(slug, seed);
  const promise = networkPromise.catch((error) => {
    const fallback = loadStoredGachaLaunch(slug);
    if (fallback) return fallback;
    throw error;
  });

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
  const hadStoredLaunch = hasStoredGachaLaunch(shopSlug);
  let launch = await loadGachaLaunch(shopSlug, seed);
  if (
    hadStoredLaunch &&
    (typeof navigator === "undefined" || navigator.onLine)
  ) {
    launch = await refreshGachaLaunch(shopSlug, seed).catch(() => launch);
  }
  if (prefetchSimulator) {
    for (const gameType of ["genshin", "hsr"] as const) {
      if (launch.catalogs[gameType]?.settings?.enabled) {
        prefetchSimulatorDocument(gameType);
      }
    }
  }
}

export function clearGachaLaunchCache(shopSlug?: string) {
  launchCache.clear();
  if (shopSlug) {
    const slug = normalizedSlug(shopSlug);
    try {
      localStorage.removeItem(`${GACHA_LAUNCH_STORAGE_PREFIX}${slug}`);
      localStorage.removeItem(`${LEGACY_GACHA_LAUNCH_STORAGE_PREFIX}${slug}`);
    } catch {
      // ignore
    }
  }
}

const gachaItemKindSchema = z.enum(["character", "weapon", "lightcone"]);

const gachaPreviewSettingsSchema = z
  .object({
    shop_id: z.string(),
    enabled: z.boolean(),
    game_type: z.enum(["genshin", "hsr"]),
    title: z.string(),
    description: z.string(),
    rare_base_rate: z.number(),
    legendary_base_rate: z.number(),
    lightcone_legendary_base_rate: z.number(),
    rare_soft_pity: z.number(),
    legendary_soft_pity: z.number(),
    lightcone_legendary_soft_pity: z.number(),
    featured_item_rate: z.number(),
    featured_guaranteed_after_loss: z.boolean(),
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
    starts_at: z.string().nullable(),
    ends_at: z.string().nullable(),
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
export function parseGachaPreviewConfig(
  raw: string | null,
): GachaCatalog | null {
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

const GACHA_LAUNCH_STORAGE_PREFIX = "matsuri-gacha-launch-v2:";
const LEGACY_GACHA_LAUNCH_STORAGE_PREFIX = "matsuri-gacha-launch-v1:";

function loadStoredGachaLaunch(slug: string): GachaLaunchData | null {
  try {
    const raw =
      localStorage.getItem(`${GACHA_LAUNCH_STORAGE_PREFIX}${slug}`) ??
      localStorage.getItem(`${LEGACY_GACHA_LAUNCH_STORAGE_PREFIX}${slug}`);
    const value = JSON.parse(raw || "null") as Record<string, unknown> | null;
    if (!value) return null;
    const shop = shopSchema.safeParse(value.shop);
    const booth = boothSettingsSchema.safeParse(value.booth);
    if (!shop.success || !booth.success) return null;
    const catalogs = value.catalogs as Record<string, unknown> | undefined;
    const parsedCatalogs: GachaCatalogsByGame = {};
    for (const gameType of ["genshin", "hsr"] as const) {
      const parsed = gachaPreviewCatalogSchema.safeParse(catalogs?.[gameType]);
      if (parsed.success)
        parsedCatalogs[gameType] = parsed.data as GachaCatalog;
    }
    if (Object.keys(parsedCatalogs).length === 0) {
      const legacyCatalog = gachaPreviewCatalogSchema.safeParse(value.catalog);
      if (!legacyCatalog.success || !legacyCatalog.data.settings) return null;
      parsedCatalogs[legacyCatalog.data.settings.game_type] =
        legacyCatalog.data as GachaCatalog;
    }
    return {
      shop: shop.data,
      booth: booth.data,
      catalogs: parsedCatalogs,
    };
  } catch {
    return null;
  }
}

function saveStoredGachaLaunch(slug: string, launch: GachaLaunchData) {
  try {
    localStorage.setItem(
      `${GACHA_LAUNCH_STORAGE_PREFIX}${slug}`,
      JSON.stringify({ ...launch, savedAt: new Date().toISOString() }),
    );
  } catch {
    // Offline launch persistence is best effort.
  }
}
