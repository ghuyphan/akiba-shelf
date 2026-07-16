import type { CartItem, Product, PromotionSettings } from "../types/catalog";
import { defaultPromotion } from "./constants";

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

export function calculateCartPricing(
  cart: CartItem[],
  promotion: PromotionSettings = defaultPromotion,
): CartPricing {
  const qualifyingIds = new Set(promotion.qualifying_product_ids);
  const rewardIds = new Set(promotion.reward_product_ids);
  const eligibleQuantity = cart.reduce(
    (sum, item) => sum + (promotion.enabled && qualifyingIds.has(item.product.id) ? item.quantity : 0),
    0,
  );
  const unlockedRewards = promotion.enabled
    ? promotion.repeatable
      ? Math.floor(eligibleQuantity / promotion.buy_quantity) * promotion.free_quantity
      : eligibleQuantity >= promotion.buy_quantity
      ? promotion.free_quantity
      : 0
    : 0;
  let rewardsRemaining = unlockedRewards;

  const lines = cart.map((item) => {
    const unitPrice = getProductPrice(item.product);
    const requestedRewardQuantity = rewardIds.has(item.product.id) ? item.reward_quantity ?? 0 : 0;
    const freeQuantity = Math.min(requestedRewardQuantity, rewardsRemaining);
    rewardsRemaining -= freeQuantity;
    const quantity = item.quantity + (item.reward_quantity ?? 0);
    const subtotal = unitPrice * quantity;
    const discountAmount = unitPrice * freeQuantity;
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
    unitsUntilNextFreeItem: promotion.enabled
      ? promotion.repeatable
        ? promotion.buy_quantity - (eligibleQuantity % promotion.buy_quantity)
        : Math.max(0, promotion.buy_quantity - eligibleQuantity)
      : 0,
    availableRewardQuantity: Math.max(0, unlockedRewards - lines.reduce((sum, line) => sum + line.freeQuantity, 0)),
  };
}
