import type { Product } from "../types/catalog";

export function validateProduct(product: Product) {
  const errors: string[] = [];

  if (!product.name.trim()) errors.push("Product name is required.");
  if (!product.item_code.trim()) errors.push("Item code is required.");
  if (!product.category.trim()) errors.push("Category is required.");
  if (!Number.isFinite(product.price_vnd) || product.price_vnd < 0) {
    errors.push("Price must be a positive number.");
  }
  if (
    product.sale_price_vnd != null &&
    (!Number.isInteger(product.sale_price_vnd) ||
      product.sale_price_vnd < 0 ||
      product.sale_price_vnd >= product.price_vnd)
  ) {
    errors.push("Sale price must be lower than the regular price.");
  }
  if (!Number.isInteger(product.quantity_available) || product.quantity_available < 0) {
    errors.push("Quantity must be a whole number.");
  }
  if (product.images.length === 0 || !product.images[0]) {
    errors.push("At least one image URL is required.");
  }

  return errors;
}
