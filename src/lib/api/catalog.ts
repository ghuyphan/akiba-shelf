import type { CatalogData, Product } from "../../types/catalog";
import { getAdminProducts, getPublicProducts } from "./products";
import {
  getAdminBoothSettings,
  getAdminPaymentSettings,
  getAdminPromotionSettings,
  getPublicBoothSettings,
  getPublicPaymentSettings,
  getPublicPromotionSettings,
} from "./settings";

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
