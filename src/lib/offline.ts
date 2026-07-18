import type { BoothSettings, CartItem, CatalogData, Product, Shop } from "../types/catalog";
import { boothSettingsSchema, productRowSchema, shopSchema } from "./schemas";

const SNAPSHOT_KEY = "akiba-shelf-catalog-v1";
const CART_KEY = "akiba-shelf-cart-v1";
const scopedKey = (key: string, shopId?: string) => shopId ? `${key}:${shopId}` : key;

type Snapshot = { version: 1; savedAt: string; products: Product[]; booth: BoothSettings };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function isProduct(value: unknown): value is Product {
  return productRowSchema.safeParse(value).success;
}

export function isCartItem(value: unknown): value is CartItem {
  if (!isRecord(value) || !isProduct(value.product)) return false;

  const quantity = value.quantity;
  const rewardQuantity = value.reward_quantity;
  return typeof quantity === "number"
    && Number.isInteger(quantity)
    && quantity >= 0
    && (rewardQuantity === undefined
      || (typeof rewardQuantity === "number"
        && Number.isInteger(rewardQuantity)
        && rewardQuantity >= 0))
    && quantity + (typeof rewardQuantity === "number" ? rewardQuantity : 0) > 0;
}

export function loadCatalogSnapshot(shopId?: string): Pick<CatalogData, "products" | "booth"> | null {
  try {
    const key = scopedKey(SNAPSHOT_KEY, shopId);
    const value = JSON.parse(localStorage.getItem(key) || "null") as unknown;
    if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.products) || !value.products.every(isProduct) || !boothSettingsSchema.safeParse(value.booth).success) {
      localStorage.removeItem(key);
      return null;
    }
    const snapshot = value as Snapshot;
    return { products: snapshot.products, booth: snapshot.booth };
  } catch {
    localStorage.removeItem(scopedKey(SNAPSHOT_KEY, shopId));
    return null;
  }
}

export function saveCatalogSnapshot(data: Pick<CatalogData, "products" | "booth">, shopId?: string) {
  try {
    localStorage.setItem(scopedKey(SNAPSHOT_KEY, shopId), JSON.stringify({ version: 1, savedAt: new Date().toISOString(), products: data.products, booth: data.booth }));
  } catch {
    // Offline caching is best-effort.
  }
}

export function loadCart(shopId?: string): CartItem[] {
  try {
    const key = scopedKey(CART_KEY, shopId);
    const value = JSON.parse(localStorage.getItem(key) || "null") as unknown;
    if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.items) || !value.items.every(isCartItem)) {
      localStorage.removeItem(key);
      return [];
    }
    return value.items;
  } catch {
    localStorage.removeItem(scopedKey(CART_KEY, shopId));
    return [];
  }
}

export function saveCart(items: CartItem[], shopId?: string) {
  try {
    localStorage.setItem(scopedKey(CART_KEY, shopId), JSON.stringify({ version: 1, items }));
  } catch {
    // Offline persistence is best-effort.
  }
}

const SHOP_SNAPSHOT_PREFIX = "akiba-shelf-shop-v1";

export function loadShopSnapshot(slug: string): Shop | null {
  if (!slug) return null;
  try {
    const key = `${SHOP_SNAPSHOT_PREFIX}:${slug}`;
    const value = JSON.parse(localStorage.getItem(key) || "null") as unknown;
    if (!isRecord(value) || value.version !== 1 || !shopSchema.safeParse(value.shop).success) {
      localStorage.removeItem(key);
      return null;
    }
    return value.shop as Shop;
  } catch {
    localStorage.removeItem(`${SHOP_SNAPSHOT_PREFIX}:${slug}`);
    return null;
  }
}

export function saveShopSnapshot(shop: Shop, slug: string) {
  if (!slug || !shop) return;
  try {
    localStorage.setItem(
      `${SHOP_SNAPSHOT_PREFIX}:${slug}`,
      JSON.stringify({ version: 1, savedAt: new Date().toISOString(), shop }),
    );
  } catch {
    // Offline caching is best-effort.
  }
}
