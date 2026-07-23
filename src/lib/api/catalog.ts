import { defaultBooth } from "../constants";
import { storefrontBootstrapSchema } from "../schemas";
import type {
  CatalogData,
  Product,
  StorefrontBootstrap,
} from "../../types/catalog";
import {
  getAdminProducts,
  getPublicProducts,
  normalizeProduct,
} from "./products";
import {
  getAdminBoothSettings,
  getAdminPaymentSettings,
  getAdminPromotionSettings,
  getPublicBoothSettings,
  getPublicPaymentSettings,
  getPublicPromotionSettings,
  normalizeBooth,
  normalizePromotion,
} from "./settings";
import { requireSupabase } from "./shared";

export async function getStorefrontBootstrap(
  shopSlug: string,
): Promise<StorefrontBootstrap> {
  const { data, error } = await requireSupabase().rpc(
    "get_storefront_bootstrap",
    { p_shop_slug: shopSlug },
  );
  if (error) throw error;
  const parsed = storefrontBootstrapSchema.parse(data);
  return {
    shop: parsed.shop,
    catalogShopId: parsed.catalog_shop_id,
    products: parsed.products.map((product) => normalizeProduct(product)),
    hasMore: parsed.has_more,
    booth: normalizeBooth(
      parsed.booth ?? { ...defaultBooth, shop_id: parsed.catalog_shop_id },
    ),
    categories: parsed.categories,
    promotion: normalizePromotion(parsed.promotion),
    gachaEnabled: parsed.gacha_enabled,
  };
}

export async function getCatalogCoreData(
  shopId: string,
): Promise<Pick<CatalogData, "products" | "booth">> {
  const boothRequest = getPublicBoothSettings(shopId);
  const products: Product[] = [];
  let hasMore = true;
  while (hasMore) {
    const page = await getPublicProducts(shopId, {
      offset: products.length,
      pageSize: 100,
    });
    products.push(...page.products);
    hasMore = page.hasMore;
  }
  return { products, booth: await boothRequest };
}

export async function getCatalogData(shopId: string): Promise<CatalogData> {
  const [catalog, payment, promotion] = await Promise.all([
    getCatalogCoreData(shopId),
    getPublicPaymentSettings(shopId),
    getPublicPromotionSettings(shopId),
  ]);
  return { ...catalog, payment, promotion };
}

export async function getAdminCatalogData(
  shopId: string,
): Promise<CatalogData> {
  const [products, booth, payment, promotion] = await Promise.all([
    getAdminProducts(shopId),
    getAdminBoothSettings(shopId),
    getAdminPaymentSettings(shopId),
    getAdminPromotionSettings(shopId),
  ]);
  return { products, booth, payment, promotion };
}
