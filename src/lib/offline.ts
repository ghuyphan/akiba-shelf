import type { BoothSettings, CartItem, CatalogData, Product } from "../types/catalog";

const SNAPSHOT_KEY = "akiba-shelf-catalog-v1";
const CART_KEY = "akiba-shelf-cart-v1";

type Snapshot = { version: 1; savedAt: string; products: Product[]; booth: BoothSettings };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function isProduct(value: unknown): value is Product {
  if (!isRecord(value)) return false;
  return typeof value.id === "string"
    && typeof value.name === "string"
    && typeof value.price_vnd === "number"
    && Number.isFinite(value.price_vnd)
    && typeof value.quantity_available === "number"
    && Number.isFinite(value.quantity_available)
    && Array.isArray(value.images)
    && value.images.every((image) => typeof image === "string");
}

export function isCartItem(value: unknown): value is CartItem {
  return isRecord(value)
    && isProduct(value.product)
    && typeof value.quantity === "number"
    && Number.isInteger(value.quantity)
    && value.quantity > 0;
}

export function loadCatalogSnapshot(): Pick<CatalogData, "products" | "booth"> | null {
  try {
    const value = JSON.parse(localStorage.getItem(SNAPSHOT_KEY) || "null") as unknown;
    if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.products) || !value.products.every(isProduct) || !isRecord(value.booth)) {
      localStorage.removeItem(SNAPSHOT_KEY);
      return null;
    }
    const snapshot = value as Snapshot;
    return { products: snapshot.products, booth: snapshot.booth };
  } catch {
    localStorage.removeItem(SNAPSHOT_KEY);
    return null;
  }
}

export function saveCatalogSnapshot(data: CatalogData) {
  try {
    localStorage.setItem(SNAPSHOT_KEY, JSON.stringify({ version: 1, savedAt: new Date().toISOString(), products: data.products, booth: data.booth }));
  } catch {
    // Offline caching is best-effort.
  }
}

export function loadCart(): CartItem[] {
  try {
    const value = JSON.parse(localStorage.getItem(CART_KEY) || "null") as unknown;
    if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.items) || !value.items.every(isCartItem)) {
      localStorage.removeItem(CART_KEY);
      return [];
    }
    return value.items;
  } catch {
    localStorage.removeItem(CART_KEY);
    return [];
  }
}

export function saveCart(items: CartItem[]) {
  try {
    localStorage.setItem(CART_KEY, JSON.stringify({ version: 1, items }));
  } catch {
    // Offline persistence is best-effort.
  }
}
