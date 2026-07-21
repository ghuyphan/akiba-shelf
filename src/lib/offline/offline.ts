import type { BoothSettings, CartItem, CatalogData, PaymentSettings, Product, PromotionSettings, Shop } from "../../types/catalog";
import { boothSettingsSchema, paymentSettingsSchema, productRowSchema, promotionSettingsSchema, shopSchema } from "../schemas";

const SNAPSHOT_KEY = "akiba-shelf-catalog-v1";
const CART_KEY = "akiba-shelf-cart-v1";
const scopedKey = (key: string, shopId?: string) => shopId ? `${key}:${shopId}` : key;

type Snapshot = {
  version: 3;
  savedAt: string;
  complete: boolean;
  products: Product[];
  booth: BoothSettings;
  payment?: PaymentSettings;
  promotion?: PromotionSettings;
  categories?: string[];
  gachaEnabled?: boolean;
};

export type CatalogSnapshot = Pick<CatalogData, "products" | "booth"> & {
  savedAt?: string;
  complete?: boolean;
  payment?: PaymentSettings;
  promotion?: PromotionSettings;
  categories?: string[];
  gachaEnabled?: boolean;
};

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

export function loadCatalogSnapshot(shopId?: string): CatalogSnapshot | null {
  try {
    const key = scopedKey(SNAPSHOT_KEY, shopId);
    const value = JSON.parse(localStorage.getItem(key) || "null") as unknown;
    if (!isRecord(value) || ![1, 2, 3].includes(Number(value.version)) || !Array.isArray(value.products) || !value.products.every(isProduct) || !boothSettingsSchema.safeParse(value.booth).success) {
      localStorage.removeItem(key);
      return null;
    }
    const snapshot = value as unknown as Snapshot;
    const payment = paymentSettingsSchema.safeParse(snapshot.payment);
    const promotion = promotionSettingsSchema.safeParse(snapshot.promotion);
    return {
      products: snapshot.products,
      booth: snapshot.booth,
      savedAt: typeof snapshot.savedAt === "string" ? snapshot.savedAt : undefined,
      complete: snapshot.version === 3 && snapshot.complete === true,
      payment: payment.success ? payment.data : undefined,
      promotion: promotion.success ? promotion.data : undefined,
      categories: Array.isArray(snapshot.categories)
        ? snapshot.categories.filter((item): item is string => typeof item === "string")
        : undefined,
      gachaEnabled: typeof snapshot.gachaEnabled === "boolean" ? snapshot.gachaEnabled : undefined,
    };
  } catch {
    localStorage.removeItem(scopedKey(SNAPSHOT_KEY, shopId));
    return null;
  }
}

export function saveCatalogSnapshot(
  data: CatalogSnapshot,
  shopId?: string,
  options: { replaceProducts?: boolean; complete?: boolean } = {},
) {
  try {
    const previous = loadCatalogSnapshot(shopId);
    const products = options.replaceProducts
      ? data.products
      : (() => {
          const merged = new Map(
            previous?.products.map((product) => [product.id, product]) ?? [],
          );
          data.products.forEach((product) => merged.set(product.id, product));
          return [...merged.values()];
        })();
    localStorage.setItem(scopedKey(SNAPSHOT_KEY, shopId), JSON.stringify({
      version: 3,
      savedAt: new Date().toISOString(),
      complete: options.complete ?? previous?.complete ?? false,
      products,
      booth: data.booth,
      payment: data.payment ?? previous?.payment,
      promotion: data.promotion ?? previous?.promotion,
      categories: data.categories ?? previous?.categories,
      gachaEnabled: data.gachaEnabled ?? previous?.gachaEnabled,
    }));
  } catch {
    // Offline caching is best-effort.
  }
}

export function replaceCompleteCatalogSnapshot(
  data: Pick<CatalogData, "products" | "booth">,
  shopId: string,
) {
  const previous = loadCatalogSnapshot(shopId);
  if (!previous?.complete) return false;
  saveCatalogSnapshot(
    {
      ...previous,
      ...data,
    },
    shopId,
    { replaceProducts: true, complete: true },
  );
  return true;
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
