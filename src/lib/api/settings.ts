import { defaultBooth, defaultPayment, defaultPromotion } from "../constants";
import {
  ADMIN_PAYMENT_COLUMNS,
  PUBLIC_BOOTH_COLUMNS,
  PUBLIC_PAYMENT_COLUMNS,
} from "../catalogQueries";
import { safePublicUrl } from "../branding";
import {
  paymentSettingsSchema,
  promotionProductMappingsSchema,
} from "../schemas";
import type {
  BoothSettings,
  PaymentSettings,
  PromotionSettings,
} from "../../types/catalog";
import { requireSupabase } from "./shared";
import { normalizeBooth, normalizePromotion } from "./settingsNormalization";
import { reportError } from "../observability";

export { normalizeBooth, normalizePromotion } from "./settingsNormalization";

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
      .select(
        "shop_id,enabled,kind,buy_quantity,free_quantity,repeatable,percentage_off,minimum_subtotal_vnd,starts_at,ends_at",
      )
      .eq("shop_id", shopId)
      .maybeSingle(),
    client
      .from("promotion_products")
      .select("product_id,role")
      .eq("shop_id", shopId),
  ]);
  if (promotion.error) throw promotion.error;
  if (mappings.error) throw mappings.error;
  const rows = promotionProductMappingsSchema.parse(mappings.data ?? []);
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
): Promise<{ booth: BoothSettings; imageCleanupPending: boolean }> {
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
  let imageCleanupPending = false;
  if (removed.length) {
    try {
      const { error: removeError } = await client.storage
        .from("payment-qr")
        .remove(removed);
      if (removeError) throw removeError;
    } catch (error) {
      imageCleanupPending = true;
      reportError(error, {
        stage: "booth_image_cleanup_after_save",
        shopId,
        pathCount: removed.length,
      });
    }
  }
  return {
    booth: normalizeBooth({
      ...data,
      logo_path: settings.logo_path,
      social_qr_logo_path: settings.social_qr_logo_path,
    }),
    imageCleanupPending,
  };
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
    p_kind: normalized.kind,
    p_buy_quantity: normalized.buy_quantity,
    p_free_quantity: normalized.free_quantity,
    p_repeatable: normalized.repeatable,
    p_percentage_off: normalized.percentage_off,
    p_minimum_subtotal_vnd: normalized.minimum_subtotal_vnd,
    p_starts_at: normalized.starts_at,
    p_ends_at: normalized.ends_at,
    p_qualifying_product_ids: normalized.qualifying_product_ids,
    p_reward_product_ids: normalized.reward_product_ids,
  });
  if (error) throw error;
  return getPublicPromotionSettings(shopId);
}
