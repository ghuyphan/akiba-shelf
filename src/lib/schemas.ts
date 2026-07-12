import { z } from "zod";

export const storefrontSections = ["featured", "booth", "controls", "cart", "products"] as const;
export const layoutOrderSchema = z.array(z.enum(storefrontSections)).length(storefrontSections.length).refine(
  (value) => new Set(value).size === storefrontSections.length && storefrontSections.every((section) => value.includes(section)),
  "Layout order must contain every storefront section exactly once.",
);

export const imageVariantSchema = z.object({ thumbnail: z.string().url(), detail: z.string().url() });

export const productRowSchema = z.object({
  id: z.string().min(1), name: z.string(), collection: z.string(), description: z.string(),
  price_vnd: z.coerce.number().int().nonnegative(), item_code: z.string(), quantity_available: z.coerce.number().int().nonnegative(),
  category: z.string(), badge: z.string().nullish().transform((value) => value ?? undefined), badge_color: z.string().nullish().transform((value) => value ?? undefined),
  stock_status: z.enum(["in_stock", "limited", "sold_out"]), stock_note: z.string(),
  images: z.array(z.string()), image_variants: z.array(imageVariantSchema).optional(), image_paths: z.array(z.string()).optional(),
  featured: z.boolean(), sort_order: z.coerce.number().int(), active: z.boolean(),
}).passthrough();

export const boothSettingsSchema = z.object({
  id: z.string().optional(), booth_name: z.string(), subtitle: z.string(), booth_code: z.string(), location: z.string(), open_hours: z.string(),
  logo_url: z.string().nullish().transform((value) => value ?? undefined), logo_path: z.string().nullish().transform((value) => value ?? undefined), instagram_url: z.string().nullish().transform((value) => value ?? undefined), facebook_url: z.string().nullish().transform((value) => value ?? undefined), tiktok_url: z.string().nullish().transform((value) => value ?? undefined),
  social_qr_logo_url: z.string().nullish().transform((value) => value ?? undefined), social_qr_logo_path: z.string().nullish().transform((value) => value ?? undefined), theme_primary: z.string().nullish().transform((value) => value ?? undefined), theme_secondary: z.string().nullish().transform((value) => value ?? undefined),
  theme_accent: z.string().nullish().transform((value) => value ?? undefined), theme_background: z.string().nullish().transform((value) => value ?? undefined), layout_order: layoutOrderSchema.nullish().transform((value) => value ?? undefined), corner_radius: z.number().int().min(0).max(32).nullish().transform((value) => value ?? undefined),
  catalog_locale: z.enum(["en", "vi"]).nullish().transform((value) => value ?? undefined), featured_autoplay: z.boolean().nullish().transform((value) => value ?? undefined),
}).passthrough();

export const paymentSettingsSchema = z.object({
  id: z.string().optional(), momo_qr_url: z.string(), bank_qr_url: z.string(), momo_label: z.string(), bank_label: z.string(), bank_code: z.string().nullish().transform((value) => value ?? undefined),
  bank_acq_id: z.string().nullish().transform((value) => value ?? undefined), bank_account_no: z.string().nullish().transform((value) => value ?? undefined), bank_account_name: z.string().nullish().transform((value) => value ?? undefined), bank_add_info_template: z.string().nullish().transform((value) => value ?? undefined), payment_instructions: z.string(),
}).passthrough();

export const orderSchema = z.object({
  id: z.string().uuid(), order_code: z.string().min(1), customer_name: z.string().nullable().optional(), total_amount: z.coerce.number().int().nonnegative(),
  status: z.enum(["pending", "confirmed", "cancelled", "expired"]), created_at: z.string(), updated_at: z.string().optional(), expires_at: z.string().nullable().optional(),
  confirmed_at: z.string().nullable().optional(), cancelled_at: z.string().nullable().optional(), expired_at: z.string().nullable().optional(),
}).passthrough();

export const orderMutationSchema = z.object({
  outcome: z.enum(["confirmed", "cancelled", "expired", "already_confirmed", "already_cancelled", "already_expired", "not_found", "invalid_state"]),
  order: orderSchema.nullable(),
});
