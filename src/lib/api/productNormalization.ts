import { LIMITED_STOCK_THRESHOLD } from "../constants";
import { safePublicUrl } from "../branding";
import type { Product, StockStatus } from "../../types/catalog";
import { safeUuid } from "../../utils/id";
import {
  booleanValue,
  numberValue,
  text,
  textArray,
} from "./valueNormalization";

const stockStatuses: StockStatus[] = ["in_stock", "limited", "sold_out"];

function stockStatus(value: unknown): StockStatus {
  return stockStatuses.includes(value as StockStatus)
    ? (value as StockStatus)
    : "in_stock";
}

function inferQuantity(product: Product) {
  if (Number.isFinite(product.quantity_available)) {
    return product.quantity_available;
  }
  const noteCount = product.stock_note?.match(/\d+/)?.[0];
  if (noteCount) return Number(noteCount);
  if (product.stock_status === "sold_out") return 0;
  if (product.stock_status === "limited") return 6;
  return 12;
}

export function normalizeProduct(product: Partial<Product>): Product {
  const normalized: Product = {
    id: text(product.id, safeUuid()),
    shop_id: text(product.shop_id) || undefined,
    name: text(product.name),
    collection: text(product.collection),
    description: text(product.description),
    price_vnd: numberValue(product.price_vnd),
    sale_price_vnd:
      product.sale_price_vnd == null
        ? null
        : numberValue(product.sale_price_vnd),
    effective_price_vnd:
      product.effective_price_vnd == null
        ? undefined
        : numberValue(product.effective_price_vnd),
    promotion_eligible: booleanValue(product.promotion_eligible),
    item_code: text(product.item_code),
    quantity_available: numberValue(product.quantity_available, Number.NaN),
    category: text(product.category),
    badge: text(product.badge),
    badge_color: text(product.badge_color, "#5f8d55"),
    stock_status: stockStatus(product.stock_status),
    stock_note: text(product.stock_note, "In stock"),
    images: textArray(product.images).flatMap(
      (value) => safePublicUrl(value) ?? [],
    ),
    image_variants: Array.isArray(product.image_variants)
      ? product.image_variants.flatMap((item) => {
          if (
            !item ||
            typeof item.thumbnail !== "string" ||
            typeof item.detail !== "string"
          ) {
            return [];
          }
          const thumbnail = safePublicUrl(item.thumbnail);
          const detail = safePublicUrl(item.detail);
          return thumbnail && detail ? [{ thumbnail, detail }] : [];
        })
      : [],
    image_paths: textArray(product.image_paths),
    featured: booleanValue(product.featured),
    sort_order: numberValue(product.sort_order),
    active: booleanValue(product.active, true),
  };
  const quantity = inferQuantity(normalized);
  return {
    ...normalized,
    quantity_available: quantity,
    stock_status:
      quantity === 0
        ? "sold_out"
        : quantity <= LIMITED_STOCK_THRESHOLD
          ? "limited"
          : "in_stock",
  };
}
