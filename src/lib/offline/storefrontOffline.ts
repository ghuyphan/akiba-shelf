import {
  getCatalogCoreData,
  getPublicGachaEnabled,
  getPublicPaymentSettings,
  getPublicPromotionSettings,
} from "../api";
import {
  loadCatalogSnapshot,
  saveCatalogSnapshot,
  saveShopSnapshot,
} from "./offline";
import { ensureOfflineNavigationReady } from "./pwa";
import { prepareGachaLaunch } from "../gacha/gachaLaunch";
import type { Shop } from "../../types/catalog";

const STOREFRONT_OFFLINE_MARKER_PREFIX = "matsuri-storefront-offline-v2";
const OFFLINE_DOWNLOAD_CONCURRENCY = 6;
type StorefrontOfflineMarker = {
  version: 4;
  shopId: string;
  savedAt: string;
  required: Array<{ url: string; cacheName: string }>;
};

function storefrontMarkerKey(slug: string) {
  return `${STOREFRONT_OFFLINE_MARKER_PREFIX}:${slug}`;
}

function cacheNameForStorefrontUrl(url: string) {
  return /\/storage\/v1\/object\/public\//.test(url)
    ? "supabase-storage-cache-v2"
    : "product-image-cache-v2";
}

function readStorefrontMarker(slug: string): StorefrontOfflineMarker | null {
  try {
    const marker = JSON.parse(
      localStorage.getItem(storefrontMarkerKey(slug)) || "null",
    ) as Partial<StorefrontOfflineMarker> | null;
    if (
      marker?.version !== 4 ||
      typeof marker.shopId !== "string" ||
      !Array.isArray(marker.required) ||
      marker.required.some(
        (item) =>
          !item ||
          typeof item.url !== "string" ||
          typeof item.cacheName !== "string",
      )
    ) {
      localStorage.removeItem(storefrontMarkerKey(slug));
      return null;
    }
    return marker as StorefrontOfflineMarker;
  } catch {
    localStorage.removeItem(storefrontMarkerKey(slug));
    return null;
  }
}

async function cacheStorefrontAssets(urls: string[]) {
  const storageCache = await caches.open("supabase-storage-cache-v2");
  const productImageCache = await caches.open("product-image-cache-v2");
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < urls.length) {
      const url = urls[nextIndex++];
      const request = new Request(url, { credentials: "same-origin" });
      const response = await fetch(request);
      if (!response.ok)
        throw new Error(
          `Could not download ${new URL(url, location.origin).pathname}.`,
        );
      const cache = cacheNameForStorefrontUrl(url) === "supabase-storage-cache-v2"
        ? storageCache
        : productImageCache;
      await cache.put(request, response);
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(OFFLINE_DOWNLOAD_CONCURRENCY, urls.length) },
      () => worker(),
    ),
  );
}

export async function prepareStorefrontOffline(shop: Shop) {
  if (!("caches" in window))
    throw new Error("Offline downloads are not supported by this browser.");
  await ensureOfflineNavigationReady();
  const shopId = shop.catalog_source_shop_id ?? shop.id;
  const [catalog, payment, promotion, gachaEnabled] = await Promise.all([
    getCatalogCoreData(shopId),
    getPublicPaymentSettings(shopId),
    getPublicPromotionSettings(shopId),
    getPublicGachaEnabled(shopId).catch(() => false),
  ]);

  if (gachaEnabled) {
    await prepareGachaLaunch(shop.slug, { shop, booth: catalog.booth }, false).catch(() => null);
  }

  saveShopSnapshot(shop, shop.slug);
  saveCatalogSnapshot(
    {
      ...catalog,
      payment,
      promotion,
      categories: [...new Set(catalog.products.map((product) => product.category).filter(Boolean))],
      gachaEnabled,
    },
    shopId,
    { replaceProducts: true, complete: true },
  );

  const imageUrls = new Set(
    [
      catalog.booth.logo_url,
      catalog.booth.social_qr_logo_url,
      payment.bank_qr_url,
      payment.momo_qr_url,
      new URL(`${import.meta.env.BASE_URL}bank-logos/${payment.bank_code || "default"}.png`, location.origin).href,
      new URL(`${import.meta.env.BASE_URL}bank-logos/MOMO.png`, location.origin).href,
      new URL(`${import.meta.env.BASE_URL}bank-logos/default.png`, location.origin).href,
      new URL(`${import.meta.env.BASE_URL}brand/napas.png`, location.origin).href,
      new URL(`${import.meta.env.BASE_URL}brand/vietqr.png`, location.origin).href,
      ...catalog.products.flatMap((product) => [
        ...product.images,
        ...(product.image_variants ?? []).flatMap((image) => [image.thumbnail, image.detail]),
      ]),
    ].filter((url): url is string => Boolean(url)),
  );
  await cacheStorefrontAssets([...imageUrls]);
  localStorage.setItem(storefrontMarkerKey(shop.slug), JSON.stringify({
    version: 4,
    shopId,
    savedAt: new Date().toISOString(),
    required: [...imageUrls].map((url) => ({
      url,
      cacheName: cacheNameForStorefrontUrl(url),
    })),
  } satisfies StorefrontOfflineMarker));
}

export function isStorefrontOfflineReady(slug: string) {
  const marker = readStorefrontMarker(slug);
  return Boolean(marker && loadCatalogSnapshot(marker.shopId)?.complete === true);
}

export async function verifyStorefrontOfflineReady(slug: string) {
  const marker = readStorefrontMarker(slug);
  if (
    !marker ||
    loadCatalogSnapshot(marker.shopId)?.complete !== true ||
    !("caches" in window)
  ) return false;
  try {
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
  } catch {
    return false;
  }
}
