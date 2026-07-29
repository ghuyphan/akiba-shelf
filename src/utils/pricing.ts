import type { CartItem, Product, PromotionSettings } from "../types/catalog";
import { defaultPromotion } from "../lib/constants";

export function getProductPrice(product: Product) {
  return product.sale_price_vnd ?? product.price_vnd;
}

export function isProductOnSale(product: Product) {
  return (
    product.sale_price_vnd != null &&
    getProductPrice(product) < product.price_vnd
  );
}

export function getProductDiscountPercent(product: Product) {
  if (!isProductOnSale(product) || product.price_vnd <= 0) return 0;
  return Math.round((1 - getProductPrice(product) / product.price_vnd) * 100);
}

export function isPromotionActive(
  promotion: PromotionSettings,
  now = new Date(),
) {
  if (!promotion.enabled) return false;
  const timestamp = now.getTime();
  const startsAt = promotion.starts_at
    ? new Date(promotion.starts_at).getTime()
    : null;
  const endsAt = promotion.ends_at
    ? new Date(promotion.ends_at).getTime()
    : null;
  if (startsAt !== null && (!Number.isFinite(startsAt) || timestamp < startsAt))
    return false;
  if (endsAt !== null && (!Number.isFinite(endsAt) || timestamp >= endsAt))
    return false;
  return true;
}

export type CartPricingLine = {
  productId: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  freeQuantity: number;
  discountAmount: number;
  total: number;
};

export type CartPricing = {
  lines: CartPricingLine[];
  subtotal: number;
  discountAmount: number;
  total: number;
  eligibleQuantity: number;
  freeQuantity: number;
  unitsUntilNextFreeItem: number;
  availableRewardQuantity: number;
};

export function getPricingLine(
  pricing: CartPricing,
  productId: string,
): CartPricingLine | undefined {
  return pricing.lines.find((line) => line.productId === productId);
}

/**
 * Single source of truth for applying promotion rewards to a cart. Recomputes
 * each reward line's `reward_quantity` from the current promotion settings,
 * capping rewards at both the unlocked reward count and the stock left after
 * the paid quantity. Lines that end up with zero units are dropped.
 */
export function normalizePromotionRewards(
  cart: CartItem[],
  promotion: PromotionSettings,
): CartItem[] {
  if (promotion.kind !== "buy_get" || !isPromotionActive(promotion)) {
    return cart.flatMap((item) =>
      item.quantity > 0 ? [{ ...item, reward_quantity: 0 }] : [],
    );
  }
  const qualifyingIds = new Set(promotion.qualifying_product_ids);
  const rewardIds = new Set(promotion.reward_product_ids);
  const qualifyingQuantity = cart.reduce(
    (sum, item) =>
      sum + (qualifyingIds.has(item.product.id) ? item.quantity : 0),
    0,
  );
  let rewardsRemaining = promotion.repeatable
    ? Math.floor(qualifyingQuantity / promotion.buy_quantity) *
      promotion.free_quantity
    : qualifyingQuantity >= promotion.buy_quantity
      ? promotion.free_quantity
      : 0;
  return cart.flatMap((item) => {
    const rewardQuantity = rewardIds.has(item.product.id)
      ? Math.min(
          item.reward_quantity ?? 0,
          rewardsRemaining,
          Math.max(0, item.product.quantity_available - item.quantity),
        )
      : 0;
    rewardsRemaining -= rewardQuantity;
    return item.quantity + rewardQuantity > 0
      ? [{ ...item, reward_quantity: rewardQuantity }]
      : [];
  });
}

export function calculateCartPricing(
  cart: CartItem[],
  promotion: PromotionSettings = defaultPromotion,
): CartPricing {
  const promotionActive = isPromotionActive(promotion);
  const qualifyingIds = new Set(promotion.qualifying_product_ids);
  const rewardIds = new Set(promotion.reward_product_ids);
  const eligibleQuantity = cart.reduce(
    (sum, item) =>
      sum +
      (promotionActive && qualifyingIds.has(item.product.id)
        ? item.quantity
        : 0),
    0,
  );
  const cartPaidSubtotal = cart.reduce(
    (sum, item) => sum + getProductPrice(item.product) * item.quantity,
    0,
  );
  const percentageApplies =
    promotionActive &&
    promotion.kind === "percentage" &&
    cartPaidSubtotal >= promotion.minimum_subtotal_vnd;
  const unlockedRewards =
    promotionActive && promotion.kind === "buy_get"
      ? promotion.repeatable
        ? Math.floor(eligibleQuantity / promotion.buy_quantity) *
          promotion.free_quantity
        : eligibleQuantity >= promotion.buy_quantity
          ? promotion.free_quantity
          : 0
      : 0;
  let rewardsRemaining = unlockedRewards;

  const lines = cart.map((item) => {
    const unitPrice = getProductPrice(item.product);
    const requestedRewardQuantity =
      promotion.kind === "buy_get" && rewardIds.has(item.product.id)
        ? (item.reward_quantity ?? 0)
        : 0;
    const freeQuantity = Math.min(requestedRewardQuantity, rewardsRemaining);
    rewardsRemaining -= freeQuantity;
    const quantity = item.quantity + requestedRewardQuantity;
    const subtotal = unitPrice * quantity;
    const discountAmount =
      percentageApplies && qualifyingIds.has(item.product.id)
        ? Math.floor(
            (unitPrice * item.quantity * promotion.percentage_off) / 100,
          )
        : unitPrice * freeQuantity;
    return {
      productId: item.product.id,
      quantity,
      unitPrice,
      subtotal,
      freeQuantity,
      discountAmount,
      total: subtotal - discountAmount,
    };
  });
  const subtotal = lines.reduce((sum, line) => sum + line.subtotal, 0);
  const discountAmount = lines.reduce(
    (sum, line) => sum + line.discountAmount,
    0,
  );

  return {
    lines,
    subtotal,
    discountAmount,
    total: subtotal - discountAmount,
    eligibleQuantity,
    freeQuantity: lines.reduce((sum, line) => sum + line.freeQuantity, 0),
    unitsUntilNextFreeItem:
      promotionActive && promotion.kind === "buy_get"
        ? promotion.repeatable
          ? promotion.buy_quantity - (eligibleQuantity % promotion.buy_quantity)
          : Math.max(0, promotion.buy_quantity - eligibleQuantity)
        : 0,
    availableRewardQuantity: Math.max(
      0,
      unlockedRewards - lines.reduce((sum, line) => sum + line.freeQuantity, 0),
    ),
  };
}
