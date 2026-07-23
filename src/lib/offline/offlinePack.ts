import type { GachaGameType } from "../../types/gacha";
import { prepareResponseForCache } from "./cacheResponse";
import { ensureOfflineNavigationReady } from "./pwa";
import { OFFLINE_CACHE_NAMES } from "./cacheNames";

type OfflineAsset = { path: string; size: number };
type OfflinePackManifest = {
  id: string;
  assets: OfflineAsset[];
};
type OfflineManifest = {
  version: 2;
  packs: Record<GachaGameType, OfflinePackManifest>;
};

type OfflinePackMarker = {
  version: 3;
  manifestVersion: 2;
  packId: string;
  required: Array<{ url: string; cacheName: string }>;
};

export type OfflinePackProgress = {
  completed: number;
  total: number;
  downloadedBytes: number;
  totalBytes: number;
};

export type MultiOfflinePackProgress = OfflinePackProgress & {
  gameType: GachaGameType;
  gameIndex: number;
  gameCount: number;
  percent: number;
};

const DOWNLOAD_CONCURRENCY = 4;
const OFFLINE_PACK_MARKER_PREFIX = "matsuri-offline-pack-v3";
const APP_SHELL_CACHE_NAME = OFFLINE_CACHE_NAMES.simulatorShell;
const MEDIA_CACHE_NAME = OFFLINE_CACHE_NAMES.simulatorMedia;
const STATIC_CACHE_NAME = OFFLINE_CACHE_NAMES.simulatorStatic;
const STORAGE_CACHE_NAME = OFFLINE_CACHE_NAMES.supabaseStorage;
const PRODUCT_IMAGE_CACHE_NAME = OFFLINE_CACHE_NAMES.productImages;

export function gachaCatalogOfflineUrls(catalog?: {
  entries: Array<{
    product: {
      images?: string[];
      image_variants?: Array<{ thumbnail: string; detail: string }>;
    };
  }>;
}) {
  if (!catalog) return [];
  return [
    ...new Set(
      catalog.entries
        .flatMap((entry) => [
          ...(entry.product.images ?? []),
          ...(entry.product.image_variants ?? []).flatMap((image) => [
            image.thumbnail,
            image.detail,
          ]),
        ])
        .filter(Boolean),
    ),
  ];
}

function markerKey(gameType: GachaGameType) {
  return `${OFFLINE_PACK_MARKER_PREFIX}:${gameType}`;
}

function cacheNameForUrl(url: string, productImage: boolean) {
  const pathname = new URL(url).pathname;
  if (productImage && !pathname.includes("/storage/v1/object/public/"))
    return PRODUCT_IMAGE_CACHE_NAME;
  if (pathname.includes("/storage/v1/object/public/"))
    return STORAGE_CACHE_NAME;
  if (/\.(?:mp4|webm|ogg|mp3|wav)$/i.test(pathname)) return MEDIA_CACHE_NAME;
  if (/\.(?:woff2?|ttf|png|jpe?g|webp|svg)$/i.test(pathname))
    return STATIC_CACHE_NAME;
  return APP_SHELL_CACHE_NAME;
}

function parseManifestPack(
  value: unknown,
  gameType: GachaGameType,
): OfflinePackManifest {
  if (!value || typeof value !== "object")
    throw new Error("The offline download list is invalid.");
  const manifest = value as Partial<OfflineManifest>;
  const pack = manifest.packs?.[gameType];
  if (
    manifest.version !== 2 ||
    !pack ||
    typeof pack.id !== "string" ||
    !pack.id ||
    !Array.isArray(pack.assets) ||
    pack.assets.length === 0
  ) {
    throw new Error("The offline download list is invalid.");
  }

  const simulator = gameType === "hsr" ? "hsr-simulator" : "gacha-simulator";
  const prefix = new URL(
    `${import.meta.env.BASE_URL}${simulator}/`,
    location.origin,
  );
  const assets = pack.assets.map((asset) => {
    if (
      !asset ||
      typeof asset.path !== "string" ||
      !Number.isSafeInteger(asset.size) ||
      asset.size < 0
    ) {
      throw new Error("The offline download list is invalid.");
    }
    const url = new URL(asset.path, location.origin);
    if (
      url.origin !== location.origin ||
      !url.pathname.startsWith(prefix.pathname)
    )
      throw new Error("The offline download list is invalid.");
    return { path: url.href, size: asset.size };
  });
  if (
    !assets.some(
      (asset) =>
        new URL(asset.path).pathname === `${prefix.pathname}index.html`,
    )
  )
    throw new Error("The offline download list is incomplete.");
  return { id: pack.id, assets };
}

async function fetchManifestPack(gameType: GachaGameType) {
  const response = await fetch(
    `${import.meta.env.BASE_URL}offline-assets.json`,
    {
      cache: "no-store",
    },
  );
  if (!response.ok)
    throw new Error("The offline download list is not available yet.");
  return parseManifestPack(await response.json(), gameType);
}

async function ensureStorageCapacity(requiredBytes: number) {
  if (!requiredBytes || !navigator.storage?.estimate) return;
  let estimate: StorageEstimate;
  try {
    estimate = await navigator.storage.estimate();
  } catch {
    return;
  }
  const quota = estimate.quota;
  const usage = estimate.usage;
  if (
    typeof quota === "number" &&
    Number.isFinite(quota) &&
    typeof usage === "number" &&
    Number.isFinite(usage) &&
    Math.max(0, quota - usage) < requiredBytes
  ) {
    throw new Error(
      "There is not enough browser storage for this offline game.",
    );
  }
}

function isQuotaError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { name?: unknown; code?: unknown };
  return candidate.name === "QuotaExceededError" || candidate.code === 22;
}

function readMarker(gameType: GachaGameType): OfflinePackMarker | null {
  try {
    const marker = JSON.parse(
      localStorage.getItem(markerKey(gameType)) || "null",
    ) as unknown;
    if (!marker || typeof marker !== "object") return null;
    const candidate = marker as Partial<OfflinePackMarker>;
    if (
      candidate.version !== 3 ||
      candidate.manifestVersion !== 2 ||
      typeof candidate.packId !== "string" ||
      !candidate.packId ||
      !Array.isArray(candidate.required) ||
      candidate.required.length === 0 ||
      candidate.required.some(
        (item) =>
          !item ||
          typeof item.url !== "string" ||
          typeof item.cacheName !== "string" ||
          !item.cacheName,
      )
    ) {
      localStorage.removeItem(markerKey(gameType));
      return null;
    }
    return candidate as OfflinePackMarker;
  } catch {
    localStorage.removeItem(markerKey(gameType));
    return null;
  }
}

async function hasRequiredAssets(marker: OfflinePackMarker) {
  const cacheByName = new Map<string, Cache>();
  for (const item of marker.required) {
    let cache = cacheByName.get(item.cacheName);
    if (!cache) {
      cache = await caches.open(item.cacheName);
      cacheByName.set(item.cacheName, cache);
    }
    if (!(await cache.match(item.url))) return false;
  }
  return true;
}

async function deleteCachedPackAssets(
  marker: OfflinePackMarker,
  gameType: GachaGameType,
) {
  const simulator = gameType === "hsr" ? "hsr-simulator" : "gacha-simulator";
  const prefix = new URL(
    `${import.meta.env.BASE_URL}${simulator}/`,
    location.origin,
  );
  const cacheByName = new Map<string, Cache>();
  for (const item of marker.required) {
    const url = new URL(item.url, location.origin);
    if (
      url.origin !== location.origin ||
      !url.pathname.startsWith(prefix.pathname)
    )
      continue;
    let cache = cacheByName.get(item.cacheName);
    if (!cache) {
      cache = await caches.open(item.cacheName);
      cacheByName.set(item.cacheName, cache);
    }
    await cache.delete(item.url);
  }
}

export function offlinePackPercent({
  completed,
  total,
}: Pick<OfflinePackProgress, "completed" | "total">) {
  if (!total || !completed) return 0;
  return Math.max(1, Math.min(100, Math.round((completed / total) * 100)));
}

export async function downloadGachaOfflinePack(
  gameType: GachaGameType,
  extraUrls: string[] = [],
  onProgress?: (progress: OfflinePackProgress) => void,
  navigationPrepared = false,
) {
  if (!("caches" in window))
    throw new Error("Offline downloads are not supported by this browser.");
  if (!navigationPrepared) await ensureOfflineNavigationReady();
  const previousMarker = readMarker(gameType);
  const pack = await fetchManifestPack(gameType);
  // Without a matching current marker, cached stable URLs may belong to an
  // older build and must be overwritten before the new pack is trusted.
  const refreshPackAssets =
    !previousMarker || previousMarker.packId !== pack.id;
  localStorage.removeItem(markerKey(gameType));
  if (previousMarker && refreshPackAssets)
    await deleteCachedPackAssets(previousMarker, gameType);
  const known = new Set(pack.assets.map((asset) => asset.path));
  const extras = extraUrls
    .map((url) => new URL(url, location.origin).href)
    .filter((url) => !known.has(url));
  const items = [
    ...pack.assets.map((asset) => ({
      url: asset.path,
      size: asset.size,
      productImage: false,
    })),
    ...extras.map((url) => ({ url, size: 0, productImage: true })),
  ].map((item) => ({
    ...item,
    cacheName: cacheNameForUrl(item.url, item.productImage),
  }));
  const cacheByName = new Map<string, Cache>();
  const getCache = async (cacheName: string) => {
    let cache = cacheByName.get(cacheName);
    if (!cache) {
      cache = await caches.open(cacheName);
      cacheByName.set(cacheName, cache);
    }
    return cache;
  };
  const cachedItems = await Promise.all(
    items.map(async (item) => ({
      item,
      cached:
        refreshPackAssets && !item.productImage
          ? false
          : Boolean(await (await getCache(item.cacheName)).match(item.url)),
    })),
  );
  await ensureStorageCapacity(
    cachedItems.reduce(
      (total, entry) => total + (entry.cached ? 0 : entry.item.size),
      0,
    ),
  );
  const progress: OfflinePackProgress = {
    completed: 0,
    total: items.length,
    downloadedBytes: 0,
    totalBytes: pack.assets.reduce((sum, asset) => sum + asset.size, 0),
  };
  onProgress?.({ ...progress });
  let nextItem = 0;
  const downloadItem = async ({
    item,
    cached,
  }: (typeof cachedItems)[number]) => {
    const request = new Request(item.url, { credentials: "same-origin" });
    const pathname = new URL(item.url).pathname;
    const targetCache = await getCache(item.cacheName);
    if (!cached) {
      const response = await fetch(request);
      if (!response.ok) throw new Error(`Could not download ${pathname}.`);
      try {
        await targetCache.put(request, prepareResponseForCache(response));
      } catch (error) {
        if (isQuotaError(error))
          throw new Error("The offline download ran out of browser storage.");
        throw error;
      }
    }
    progress.completed += 1;
    progress.downloadedBytes += item.size;
    onProgress?.({ ...progress });
  };
  const worker = async () => {
    while (nextItem < cachedItems.length) {
      const item = cachedItems[nextItem];
      nextItem += 1;
      await downloadItem(item);
    }
  };
  await Promise.all(
    Array.from(
      { length: Math.min(DOWNLOAD_CONCURRENCY, cachedItems.length) },
      () => worker(),
    ),
  );
  const marker: OfflinePackMarker = {
    version: 3,
    manifestVersion: 2,
    packId: pack.id,
    required: items.map((item) => ({
      url: item.url,
      cacheName: item.cacheName,
    })),
  };
  try {
    localStorage.setItem(markerKey(gameType), JSON.stringify(marker));
  } catch {
    throw new Error("The browser could not save offline game readiness.");
  }
  return progress;
}

/** Downloads several game packs through one resumable user action. */
export async function downloadGachaOfflinePacks(
  gameTypes: GachaGameType[],
  extraUrlsByGame: Partial<Record<GachaGameType, string[]>> = {},
  onProgress?: (progress: MultiOfflinePackProgress) => void,
) {
  const uniqueGames = [...new Set(gameTypes)];
  if (uniqueGames.length) await ensureOfflineNavigationReady();
  for (let gameIndex = 0; gameIndex < uniqueGames.length; gameIndex += 1) {
    const gameType = uniqueGames[gameIndex];
    if (await hasGachaOfflinePack(gameType)) {
      onProgress?.({
        gameType,
        gameIndex,
        gameCount: uniqueGames.length,
        completed: 1,
        total: 1,
        downloadedBytes: 0,
        totalBytes: 0,
        percent: Math.round(((gameIndex + 1) / uniqueGames.length) * 100),
      });
      continue;
    }
    await downloadGachaOfflinePack(
      gameType,
      extraUrlsByGame[gameType] ?? [],
      (progress) => {
        const currentPercent = offlinePackPercent(progress) / 100;
        onProgress?.({
          ...progress,
          gameType,
          gameIndex,
          gameCount: uniqueGames.length,
          percent: Math.max(
            1,
            Math.round(
              ((gameIndex + currentPercent) / uniqueGames.length) * 100,
            ),
          ),
        });
      },
      true,
    );
  }
}

export async function hasGachaOfflinePack(gameType: GachaGameType) {
  if (!("caches" in window)) return false;
  const marker = readMarker(gameType);
  if (!marker) return false;
  try {
    if (navigator.onLine) {
      let currentPack: OfflinePackManifest | null = null;
      try {
        currentPack = await fetchManifestPack(gameType);
      } catch {
        // A transient manifest failure must not invalidate a complete local pack.
      }
      if (currentPack?.id !== undefined && currentPack.id !== marker.packId) {
        localStorage.removeItem(markerKey(gameType));
        try {
          await deleteCachedPackAssets(marker, gameType);
        } catch {
          // The removed marker keeps a proven stale pack from being trusted.
        }
        return false;
      }
      if (currentPack) {
        const requiredUrls = new Set(marker.required.map((item) => item.url));
        if (currentPack.assets.some((asset) => !requiredUrls.has(asset.path))) {
          localStorage.removeItem(markerKey(gameType));
          return false;
        }
      }
    }
    if (await hasRequiredAssets(marker)) return true;
  } catch {
    // Cache access can fail in private/low-storage browser modes.
  }
  localStorage.removeItem(markerKey(gameType));
  return false;
}
