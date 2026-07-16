import { getGachaCatalog, getPublicBoothSettings, getPublicShop } from "./api";
import type { BoothSettings, Shop } from "../types/catalog";
import type { GachaCatalog, GachaGameType } from "../types/gacha";

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
