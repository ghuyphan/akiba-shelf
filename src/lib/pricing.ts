import type { Product } from "../types/catalog";

export function getProductPrice(product: Product) {
  return product.sale_price_vnd ?? product.price_vnd;
}

export function isProductOnSale(product: Product) {
  return product.sale_price_vnd != null && getProductPrice(product) < product.price_vnd;
}

export function getProductDiscountPercent(product: Product) {
  if (!isProductOnSale(product) || product.price_vnd <= 0) return 0;
  return Math.round((1 - getProductPrice(product) / product.price_vnd) * 100);
}
