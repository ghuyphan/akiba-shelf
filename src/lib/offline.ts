import type { BoothSettings, CartItem, CatalogData, Product } from "../types/catalog";
import { boothSettingsSchema, productRowSchema } from "./schemas";

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
  return isRecord(value)
    && isProduct(value.product)
    && typeof value.quantity === "number"
    && Number.isInteger(value.quantity)
    && value.quantity >= 0
    && (value.reward_quantity === undefined || (Number.isInteger(value.reward_quantity) && value.reward_quantity >= 0))
    && value.quantity + (value.reward_quantity ?? 0) > 0;
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
