import type { Product } from "../types/catalog";

export function getStockLabel(product: Product) {
  if (product.stock_status === "sold_out" || product.quantity_available === 0) return "Sold out";
  return `${product.quantity_available} available`;
}

export function getStockTone(product: Product) {
  if (product.stock_status === "sold_out" || product.quantity_available === 0) return "stock-out";
  if (product.stock_status === "limited" || product.quantity_available <= 6) return "stock-limited";
  return "stock-good";
}

export function getItemQrPayload(product: Product) {
  return JSON.stringify({
    type: "merch-item",
    code: product.item_code,
    name: product.name,
    price_vnd: product.price_vnd,
  });
}
