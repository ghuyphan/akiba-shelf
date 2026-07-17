import type { Product } from "../types/catalog";

export function getStockTone(product: Product) {
  if (product.quantity_available === 0) return "stock-out";
  if (product.quantity_available <= 6) return "stock-limited";
  return "stock-good";
}
