import { defaultBooth, defaultPayment, defaultPromotion } from "../constants";
import {
  ADMIN_PAYMENT_COLUMNS,
  PUBLIC_BOOTH_COLUMNS,
  PUBLIC_PAYMENT_COLUMNS,
} from "../catalogQueries";
import { safePublicUrl } from "../branding";
import {
  boothSettingsSchema,
  paymentSettingsSchema,
  promotionSettingsSchema,
} from "../schemas";
import type {
  BoothSettings,
  PaymentSettings,
  PromotionSettings,
} from "../../types/catalog";
import {
  booleanValue,
  numberValue,
  requireSupabase,
  textArray,
} from "./shared";

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

export function normalizePayment(payment: unknown): PaymentSettings {
  const normalized = {
    ...defaultPayment,
    ...paymentSettingsSchema.parse(payment),
  };
  return {
    ...normalized,
    momo_qr_url: safePublicUrl(normalized.momo_qr_url) ?? "",
    bank_qr_url: safePublicUrl(normalized.bank_qr_url) ?? "",
  };
}

export function normalizeBooth(booth: unknown): BoothSettings {
  return { ...defaultBooth, ...boothSettingsSchema.parse(booth) };
}

export async function getPublicBoothSettings(
  shopId: string,
): Promise<BoothSettings> {
  const { data, error } = await requireSupabase()
    .from("booth_settings")
    .select(PUBLIC_BOOTH_COLUMNS)
    .eq("shop_id", shopId)
    .maybeSingle();
  if (error) throw error;
  return normalizeBooth(data ?? { ...defaultBooth, shop_id: shopId });
}

export async function getPublicPaymentSettings(
  shopId: string,
): Promise<PaymentSettings> {
  const { data, error } = await requireSupabase()
    .from("payment_settings")
    .select(PUBLIC_PAYMENT_COLUMNS)
    .eq("shop_id", shopId)
    .maybeSingle();
  if (error) throw error;
  return normalizePayment(data ?? defaultPayment);
}

export async function getPublicPromotionSettings(
  shopId: string,
): Promise<PromotionSettings> {
  const client = requireSupabase();
  const [promotion, mappings] = await Promise.all([
    client
      .from("promotions")
      .select("shop_id,enabled,buy_quantity,free_quantity,repeatable")
      .eq("shop_id", shopId)
      .maybeSingle(),
    client
      .from("promotion_products")
      .select("product_id,role")
      .eq("shop_id", shopId),
  ]);
  if (promotion.error) throw promotion.error;
  if (mappings.error) throw mappings.error;
  const rows = (mappings.data ?? []) as {
    product_id: string;
    role: "qualifying" | "reward" | "both";
  }[];
  return normalizePromotion({
    ...(promotion.data ?? { ...defaultPromotion, shop_id: shopId }),
    qualifying_product_ids: rows
      .filter((row) => row.role === "qualifying" || row.role === "both")
      .map((row) => row.product_id),
    reward_product_ids: rows
      .filter((row) => row.role === "reward" || row.role === "both")
      .map((row) => row.product_id),
  });
}

export async function getAdminBoothSettings(
  shopId: string,
): Promise<BoothSettings> {
  const { data, error } = await requireSupabase()
    .rpc("get_admin_booth_settings", { p_shop_id: shopId })
    .maybeSingle();
  if (error) throw error;
  return normalizeBooth(data ?? { ...defaultBooth, shop_id: shopId });
}

export async function getAdminPaymentSettings(
  shopId: string,
): Promise<PaymentSettings> {
  const { data, error } = await requireSupabase()
    .from("payment_settings")
    .select(ADMIN_PAYMENT_COLUMNS)
    .eq("shop_id", shopId)
    .maybeSingle();
  if (error) throw error;
  return normalizePayment(data ?? defaultPayment);
}

export const getAdminPromotionSettings = getPublicPromotionSettings;

export async function saveBoothSettings(
  shopId: string,
  settings: BoothSettings,
) {
  const client = requireSupabase();
  const { data: previousData, error: previousError } = await client
    .rpc("get_admin_booth_settings", { p_shop_id: shopId })
    .maybeSingle();
  if (previousError) throw previousError;
  const previous = previousData as {
    logo_path?: string;
    social_qr_logo_path?: string;
  } | null;
  const payload = { ...settings, id: settings.id ?? shopId, shop_id: shopId };
  // Private paths make update/insert safer than a grant-expanding upsert.
  const write = previous
    ? client.from("booth_settings").update(payload).eq("shop_id", shopId)
    : client.from("booth_settings").insert(payload);
  const { data, error } = await write.select(PUBLIC_BOOTH_COLUMNS).single();
  if (error) throw error;
  const removed = [previous?.logo_path, previous?.social_qr_logo_path].filter(
    (path): path is string =>
      Boolean(path) &&
      path !== settings.logo_path &&
      path !== settings.social_qr_logo_path,
  );
  if (removed.length) {
    const { error: removeError } = await client.storage
      .from("payment-qr")
      .remove(removed);
    if (removeError) throw removeError;
  }
  return normalizeBooth({
    ...data,
    logo_path: settings.logo_path,
    social_qr_logo_path: settings.social_qr_logo_path,
  });
}

export async function savePaymentSettings(
  shopId: string,
  settings: PaymentSettings,
) {
  const client = requireSupabase();
  const { data: existing, error: existingError } = await client
    .from("payment_settings")
    .select("id")
    .eq("shop_id", shopId)
    .maybeSingle();
  if (existingError) throw existingError;
  const payload = { ...settings, id: settings.id ?? shopId, shop_id: shopId };
  const write = existing
    ? client.from("payment_settings").update(payload).eq("shop_id", shopId)
    : client.from("payment_settings").insert(payload);
  const { data, error } = await write.select(ADMIN_PAYMENT_COLUMNS).single();
  if (error) throw error;
  return normalizePayment(data);
}

export async function savePromotionSettings(
  shopId: string,
  promotion: PromotionSettings,
): Promise<PromotionSettings> {
  const normalized = normalizePromotion({ ...promotion, shop_id: shopId });
  const { error } = await requireSupabase().rpc("save_promotion_settings", {
    p_shop_id: shopId,
    p_enabled: normalized.enabled,
    p_buy_quantity: normalized.buy_quantity,
    p_free_quantity: normalized.free_quantity,
    p_repeatable: normalized.repeatable,
    p_qualifying_product_ids: normalized.qualifying_product_ids,
    p_reward_product_ids: normalized.reward_product_ids,
  });
  if (error) throw error;
  return getPublicPromotionSettings(shopId);
}
