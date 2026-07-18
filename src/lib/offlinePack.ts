import type { GachaGameType } from "../types/gacha";
import { ensureOfflineNavigationReady } from "./pwa";

type OfflineAsset = { path: string; size: number };
type OfflineManifest = {
  version: number;
  packs: Record<GachaGameType, OfflineAsset[]>;
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
) {
  if (!("caches" in window))
    throw new Error("Offline downloads are not supported by this browser.");
  await ensureOfflineNavigationReady();
  const manifestResponse = await fetch(
    `${import.meta.env.BASE_URL}offline-assets.json`,
    { cache: "no-store" },
  );
  if (!manifestResponse.ok)
    throw new Error("The offline download list is not available yet.");
  const manifest = (await manifestResponse.json()) as OfflineManifest;
  const assets = manifest.packs?.[gameType] ?? [];
  const known = new Set(assets.map((asset) => new URL(asset.path, location.origin).href));
  const extras = extraUrls
    .map((url) => new URL(url, location.origin).href)
    .filter((url) => !known.has(url));
  const items = [
    ...assets.map((asset) => ({
      url: new URL(asset.path, location.origin).href,
      size: asset.size,
      productImage: false,
    })),
    ...extras.map((url) => ({ url, size: 0, productImage: true })),
  ];
  const simulatorCache = await caches.open("gacha-app-shell-v2");
  const mediaCache = await caches.open("gacha-media-cache-v1");
  const staticCache = await caches.open("gacha-static-cache-v1");
  const storageCache = await caches.open("supabase-storage-cache");
  const productImageCache = await caches.open("product-image-cache-v1");
  const progress: OfflinePackProgress = {
    completed: 0,
    total: items.length,
    downloadedBytes: 0,
    totalBytes: assets.reduce((sum, asset) => sum + asset.size, 0),
  };
  onProgress?.({ ...progress });
  let nextItem = 0;
  const downloadItem = async (item: (typeof items)[number]) => {
    const request = new Request(item.url, { credentials: "same-origin" });
    const pathname = new URL(item.url).pathname;
    const targetCache = item.productImage && !pathname.includes("/storage/v1/object/public/")
      ? productImageCache
      : pathname.includes("/storage/v1/object/public/")
      ? storageCache
      : /\.(?:mp4|webm|ogg|mp3|wav)$/i.test(pathname)
        ? mediaCache
        : /\.(?:woff2?|ttf|png|jpe?g|webp|svg)$/i.test(pathname)
          ? staticCache
          : simulatorCache;
    const cached = await targetCache.match(request);
    if (!cached) {
      const response = await fetch(request);
      if (!response.ok && response.type !== "opaque")
        throw new Error(`Could not download ${pathname}.`);
      await targetCache.put(request, response);
    }
    progress.completed += 1;
    progress.downloadedBytes += item.size;
    onProgress?.({ ...progress });
  };
  const worker = async () => {
    while (nextItem < items.length) {
      const item = items[nextItem];
      nextItem += 1;
      await downloadItem(item);
    }
  };
  await Promise.all(
    Array.from(
      { length: Math.min(DOWNLOAD_CONCURRENCY, items.length) },
      () => worker(),
    ),
  );
  localStorage.setItem(`matsuri-offline-pack:${gameType}`, new Date().toISOString());
  return progress;
}

/** Downloads several game packs through one resumable user action. */
export async function downloadGachaOfflinePacks(
  gameTypes: GachaGameType[],
  extraUrlsByGame: Partial<Record<GachaGameType, string[]>> = {},
  onProgress?: (progress: MultiOfflinePackProgress) => void,
) {
  const uniqueGames = [...new Set(gameTypes)];
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
    );
  }
}

export async function hasGachaOfflinePack(gameType: GachaGameType) {
  const markerKey = `matsuri-offline-pack:${gameType}`;
  if (!localStorage.getItem(markerKey) || !("caches" in window)) return false;
  const simulator = gameType === "hsr" ? "hsr-simulator" : "gacha-simulator";
  const shellUrl = new URL(
    `${import.meta.env.BASE_URL}${simulator}/index.html`,
    location.origin,
  );
  const shellCache = await caches.open("gacha-app-shell-v2");
  const shell = await shellCache.match(shellUrl.href);
  if (shell) return true;
  localStorage.removeItem(markerKey);
  return false;
}
