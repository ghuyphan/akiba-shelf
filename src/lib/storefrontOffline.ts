import {
  getCatalogCoreData,
  getPublicGachaEnabled,
  getPublicPaymentSettings,
  getPublicPromotionSettings,
} from "./api";
import { saveCatalogSnapshot, saveShopSnapshot } from "./offline";
import { ensureOfflineNavigationReady } from "./pwa";
import type { Shop } from "../types/catalog";

const STOREFRONT_OFFLINE_MARKER_PREFIX = "matsuri-storefront-offline-v2";

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
  );

  const imageUrls = new Set(
    [
      catalog.booth.logo_url,
      catalog.booth.social_qr_logo_url,
      payment.bank_qr_url,
      payment.momo_qr_url,
      ...catalog.products.flatMap((product) => [
        ...product.images,
        ...(product.image_variants ?? []).flatMap((image) => [image.thumbnail, image.detail]),
      ]),
    ].filter((url): url is string => Boolean(url)),
  );
  const storageCache = await caches.open("supabase-storage-cache-v2");
  await Promise.all(
    [...imageUrls].map(async (url) => {
      const request = new Request(url, { credentials: "same-origin" });
      const response = await fetch(request);
      if (!response.ok)
        throw new Error(
          `Could not download ${new URL(url, location.origin).pathname}.`,
        );
      await storageCache.put(request, response);
    }),
  );
  localStorage.setItem(
    `${STOREFRONT_OFFLINE_MARKER_PREFIX}:${shop.slug}`,
    new Date().toISOString(),
  );
}

export function isStorefrontOfflineReady(slug: string) {
  return Boolean(
    localStorage.getItem(`${STOREFRONT_OFFLINE_MARKER_PREFIX}:${slug}`),
  );
}
