import {
  getCatalogCoreData,
  getPublicPaymentSettings,
  getPublicPromotionSettings,
} from "./api";
import { saveCatalogSnapshot, saveShopSnapshot } from "./offline";
import { ensureOfflineNavigationReady } from "./pwa";
import type { Shop } from "../types/catalog";

export async function prepareStorefrontOffline(shop: Shop) {
  if (!("caches" in window))
    throw new Error("Offline downloads are not supported by this browser.");
  await ensureOfflineNavigationReady();
  const shopId = shop.catalog_source_shop_id ?? shop.id;
  const [catalog, payment, promotion] = await Promise.all([
    getCatalogCoreData(shopId),
    getPublicPaymentSettings(shopId),
    getPublicPromotionSettings(shopId),
  ]);
  saveShopSnapshot(shop, shop.slug);
  saveCatalogSnapshot(
    {
      ...catalog,
      payment,
      promotion,
      categories: [...new Set(catalog.products.map((product) => product.category).filter(Boolean))],
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
  const storageCache = await caches.open("supabase-storage-cache");
  await Promise.allSettled(
    [...imageUrls].map(async (url) => {
      const request = new Request(url, { credentials: "same-origin" });
      const response = await fetch(request);
      if (response.ok || response.type === "opaque")
        await storageCache.put(request, response);
    }),
  );
  localStorage.setItem(`matsuri-storefront-offline:${shop.slug}`, new Date().toISOString());
}

export function isStorefrontOfflineReady(slug: string) {
  return Boolean(localStorage.getItem(`matsuri-storefront-offline:${slug}`));
}
