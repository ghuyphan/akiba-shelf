import { defaultBooth, defaultPromotion } from "../constants";
import {
  boothSettingsSchema,
  promotionSettingsSchema,
} from "../schemas";
import type { BoothSettings, PromotionSettings } from "../../types/catalog";
import {
  booleanValue,
  numberValue,
  textArray,
} from "./valueNormalization";

export function normalizePromotion(
  promotion: Partial<PromotionSettings>,
): PromotionSettings {
  return promotionSettingsSchema.parse({
    ...defaultPromotion,
    ...promotion,
    enabled: booleanValue(promotion.enabled),
    repeatable: booleanValue(promotion.repeatable, true),
    buy_quantity: numberValue(promotion.buy_quantity, 3),
    free_quantity: numberValue(promotion.free_quantity, 1),
    qualifying_product_ids: textArray(promotion.qualifying_product_ids),
    reward_product_ids: textArray(promotion.reward_product_ids),
  });
}

export function normalizeBooth(booth: unknown): BoothSettings {
  return { ...defaultBooth, ...boothSettingsSchema.parse(booth) };
}
