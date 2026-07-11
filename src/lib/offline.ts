import type { BoothSettings, CartItem, CatalogData, Product } from "../types/catalog";
const SNAPSHOT_KEY = "akiba-shelf-catalog-v1";
const CART_KEY = "akiba-shelf-cart-v1";
type Snapshot = { version: 1; savedAt: string; products: Product[]; booth: BoothSettings };
export function loadCatalogSnapshot(): Pick<CatalogData, "products" | "booth"> | null {
  try { const value = JSON.parse(localStorage.getItem(SNAPSHOT_KEY) || "null") as Snapshot | null; return value?.version === 1 && Array.isArray(value.products) && value.booth ? value : null; }
  catch { localStorage.removeItem(SNAPSHOT_KEY); return null; }
}
export function saveCatalogSnapshot(data: CatalogData) { try { localStorage.setItem(SNAPSHOT_KEY, JSON.stringify({ version: 1, savedAt: new Date().toISOString(), products: data.products, booth: data.booth })); } catch { /* non-fatal */ } }
export function loadCart(): CartItem[] { try { const value = JSON.parse(localStorage.getItem(CART_KEY) || "null") as { version: 1; items: CartItem[] } | null; return value?.version === 1 && Array.isArray(value.items) ? value.items : []; } catch { localStorage.removeItem(CART_KEY); return []; } }
export function saveCart(items: CartItem[]) { try { localStorage.setItem(CART_KEY, JSON.stringify({ version: 1, items })); } catch { /* non-fatal */ } }
