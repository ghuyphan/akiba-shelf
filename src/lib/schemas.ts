import { z } from "zod";

export const hexColorSchema = z
  .string()
  .regex(/^#[\da-f]{6}$/i, "Use a 6 digit hex color.")
  .transform((value) => value.toLowerCase());

export const storefrontSections = [
  "featured",
  "booth",
  "controls",
  "cart",
  "products",
] as const;
export const layoutOrderSchema = z
  .array(z.enum(storefrontSections))
  .length(storefrontSections.length)
  .refine(
    (value) =>
      new Set(value).size === storefrontSections.length &&
      storefrontSections.every((section) => value.includes(section)),
    "Layout order must contain every storefront section exactly once.",
  );

export const imageVariantSchema = z.object({
  thumbnail: z.string().url(),
  detail: z.string().url(),
});

export const productRowSchema = z
  .object({
    id: z.string().min(1),
    name: z.string(),
    collection: z.string(),
    description: z.string(),
    price_vnd: z.coerce.number().int().nonnegative(),
    sale_price_vnd: z.coerce.number().int().nonnegative().nullable().optional(),
    effective_price_vnd: z.coerce.number().int().nonnegative().optional(),
    promotion_eligible: z.boolean().optional(),
    item_code: z.string(),
    quantity_available: z.coerce.number().int().nonnegative(),
    category: z.string(),
    badge: z
      .string()
      .nullish()
      .transform((value) => value ?? undefined),
    badge_color: z
      .string()
      .nullish()
      .transform((value) => value ?? undefined),
    stock_status: z.enum(["in_stock", "limited", "sold_out"]),
    stock_note: z.string(),
    images: z.array(z.string()),
    image_variants: z.array(imageVariantSchema).optional(),
    image_paths: z.array(z.string()).optional(),
    featured: z.boolean(),
    sort_order: z.coerce.number().int(),
    active: z.boolean(),
  })
  .passthrough();

export const boothSettingsSchema = z
  .object({
    id: z.string().optional(),
    booth_name: z.string(),
    subtitle: z.string(),
    booth_code: z.string(),
    location: z.string(),
    open_hours: z.string(),
    logo_url: z
      .string()
      .nullish()
      .transform((value) => value ?? undefined),
    logo_path: z
      .string()
      .nullish()
      .transform((value) => value ?? undefined),
    instagram_url: z
      .string()
      .nullish()
      .transform((value) => value ?? undefined),
    instagram_visible: z
      .boolean()
      .nullish()
      .transform((value) => value ?? true),
    facebook_url: z
      .string()
      .nullish()
      .transform((value) => value ?? undefined),
    facebook_visible: z
      .boolean()
      .nullish()
      .transform((value) => value ?? true),
    tiktok_url: z
      .string()
      .nullish()
      .transform((value) => value ?? undefined),
    tiktok_visible: z
      .boolean()
      .nullish()
      .transform((value) => value ?? true),
    x_url: z
      .string()
      .nullish()
      .transform((value) => value ?? undefined),
    x_visible: z
      .boolean()
      .nullish()
      .transform((value) => value ?? true),
    threads_url: z
      .string()
      .nullish()
      .transform((value) => value ?? undefined),
    threads_visible: z
      .boolean()
      .nullish()
      .transform((value) => value ?? true),
    youtube_url: z
      .string()
      .nullish()
      .transform((value) => value ?? undefined),
    youtube_visible: z
      .boolean()
      .nullish()
      .transform((value) => value ?? true),
    social_qr_logo_url: z
      .string()
      .nullish()
      .transform((value) => value ?? undefined),
    social_qr_logo_path: z
      .string()
      .nullish()
      .transform((value) => value ?? undefined),
    theme_primary: hexColorSchema
      .nullish()
      .transform((value) => value ?? undefined),
    theme_secondary: hexColorSchema
      .nullish()
      .transform((value) => value ?? undefined),
    theme_accent: hexColorSchema
      .nullish()
      .transform((value) => value ?? undefined),
    theme_background: hexColorSchema
      .nullish()
      .transform((value) => value ?? undefined),
    layout_order: layoutOrderSchema
      .nullish()
      .transform((value) => value ?? undefined),
    corner_radius: z
      .number()
      .int()
      .min(0)
      .max(32)
      .nullish()
      .transform((value) => value ?? undefined),
    card_style: z
      .enum(["soft", "outlined", "elevated", "playful"])
      .nullish()
      .transform((value) => value ?? undefined),
    featured_style: z
      .enum(["deck", "editorial", "minimal", "poster"])
      .nullish()
      .transform((value) => value ?? undefined),
    controls_style: z
      .enum(["panel", "floating", "compact", "playful"])
      .nullish()
      .transform((value) => value ?? undefined),
    product_style: z
      .enum(["classic", "minimal", "framed", "playful"])
      .nullish()
      .transform((value) => value ?? undefined),
    booth_style: z
      .enum(["classic", "compact", "banner", "playful"])
      .nullish()
      .transform((value) => value ?? undefined),
    cart_style: z
      .enum(["classic", "compact", "playful"])
      .nullish()
      .transform((value) => value ?? undefined),
    catalog_locale: z
      .enum(["en", "vi"])
      .nullish()
      .transform((value) => value ?? undefined),
    featured_autoplay: z
      .boolean()
      .nullish()
      .transform((value) => value ?? undefined),
  })
  .passthrough();

export const paymentSettingsSchema = z
  .object({
    id: z.string().optional(),
    momo_qr_url: z.string(),
    bank_qr_url: z.string(),
    momo_label: z.string(),
    bank_label: z.string(),
    bank_code: z
      .string()
      .nullish()
      .transform((value) => value ?? undefined),
    bank_acq_id: z
      .string()
      .nullish()
      .transform((value) => value ?? undefined),
    bank_account_no: z
      .string()
      .nullish()
      .transform((value) => value ?? undefined),
    bank_account_name: z
      .string()
      .nullish()
      .transform((value) => value ?? undefined),
    bank_add_info_template: z
      .string()
      .nullish()
      .transform((value) => value ?? undefined),
    payment_instructions: z.string(),
    auto_confirm_enabled: z.boolean().optional().default(false),
    webhook_secret: z
      .string()
      .nullish()
      .transform((value) => value ?? undefined),
    payos_client_id: z
      .string()
      .nullish()
      .transform((value) => value ?? undefined),
    payos_api_key: z
      .string()
      .nullish()
      .transform((value) => value ?? undefined),
    payos_checksum_key: z
      .string()
      .nullish()
      .transform((value) => value ?? undefined),
  })
  .passthrough();

export const promotionSettingsSchema = z
  .object({
    shop_id: z.string().uuid().optional(),
    enabled: z.boolean(),
    kind: z.enum(["buy_get", "percentage"]).optional().default("buy_get"),
    buy_quantity: z.coerce.number().int().min(1).max(99),
    free_quantity: z.coerce.number().int().min(1).max(99),
    repeatable: z.boolean(),
    percentage_off: z.coerce
      .number()
      .int()
      .min(1)
      .max(100)
      .optional()
      .default(10),
    minimum_subtotal_vnd: z.coerce
      .number()
      .int()
      .min(0)
      .max(2_000_000_000)
      .optional()
      .default(0),
    starts_at: z
      .string()
      .datetime({ offset: true })
      .nullable()
      .optional()
      .default(null),
    ends_at: z
      .string()
      .datetime({ offset: true })
      .nullable()
      .optional()
      .default(null),
    qualifying_product_ids: z
      .array(z.string().min(1).max(160))
      .max(500)
      .optional()
      .default([]),
    reward_product_ids: z
      .array(z.string().min(1).max(160))
      .max(500)
      .optional()
      .default([]),
  })
  .passthrough();

export const orderSchema = z
  .object({
    id: z.string().uuid(),
    order_code: z.string().min(1),
    customer_name: z.string().nullable().optional(),
    total_amount: z.coerce.number().int().nonnegative(),
    discount_amount: z.coerce.number().int().nonnegative().optional(),
    status: z.enum(["pending", "confirmed", "cancelled", "expired"]),
    created_at: z.string(),
    updated_at: z.string().optional(),
    expires_at: z.string().nullable().optional(),
    confirmed_at: z.string().nullable().optional(),
    cancelled_at: z.string().nullable().optional(),
    expired_at: z.string().nullable().optional(),
    fulfillment_status: z
      .enum(["unfulfilled", "preparing", "ready", "picked_up"])
      .optional(),
    fulfillment_updated_at: z.string().nullable().optional(),
    confirmed_by_email: z.string().nullable().optional(),
    cancelled_by_email: z.string().nullable().optional(),
    fulfillment_updated_by_email: z.string().nullable().optional(),
  })
  .passthrough();

export const orderItemProductSchema = z
  .object({
    id: z.string().min(1),
    name: z.string(),
    item_code: z.string(),
    images: z.array(z.string()),
  })
  .passthrough();

export const orderStatusCountsSchema = z.object({
  pending: z.coerce.number().int().nonnegative(),
  confirmed: z.coerce.number().int().nonnegative(),
  cancelled: z.coerce.number().int().nonnegative(),
  expired: z.coerce.number().int().nonnegative(),
  all: z.coerce.number().int().nonnegative(),
});

export const salesProductSummarySchema = z.object({
  product_id: z.string().min(1),
  name: z.string(),
  item_code: z.string(),
  units: z.coerce.number().int().nonnegative(),
  revenue: z.coerce.number().int().nonnegative(),
  discount_amount: z.coerce.number().int().nonnegative(),
});

export const salesSummarySchema = z.object({
  from: z.string().datetime({ offset: true }),
  to: z.string().datetime({ offset: true }),
  revenue: z.coerce.number().int().nonnegative(),
  discount_amount: z.coerce.number().int().nonnegative(),
  confirmed_order_count: z.coerce.number().int().nonnegative(),
  units_sold: z.coerce.number().int().nonnegative(),
  online_revenue: z.coerce.number().int().nonnegative(),
  event_revenue: z.coerce.number().int().nonnegative(),
  cash_revenue: z.coerce.number().int().nonnegative(),
  vietqr_revenue: z.coerce.number().int().nonnegative(),
  product_breakdown: z.array(salesProductSummarySchema),
});

export const orderNotificationStatusSchema = z
  .object({
    order_id: z.string().uuid(),
    status: z.enum([
      "pending",
      "queued",
      "sending",
      "retryable_failed",
      "delivered",
      "skipped",
      "dead_letter",
    ]),
    attempt_count: z.coerce.number().int().nonnegative(),
    failed_endpoint_count: z.coerce.number().int().nonnegative(),
    next_attempt_at: z.string().nullable(),
    delivered_at: z.string().nullable(),
    skipped_at: z.string().nullable(),
    dead_lettered_at: z.string().nullable(),
    updated_at: z.string(),
    last_error: z.string().nullable(),
    due_count: z.coerce.number().int().nonnegative(),
    oldest_due_at: z.string().nullable(),
    retryable_failed_count: z.coerce.number().int().nonnegative(),
    dead_letter_count: z.coerce.number().int().nonnegative(),
  })
  .passthrough();

export const orderNotificationStatusListSchema = z.array(
  orderNotificationStatusSchema,
);

export const orderNotificationRetrySchema = z.boolean();

export const orderMutationSchema = z.object({
  outcome: z.enum([
    "confirmed",
    "cancelled",
    "expired",
    "already_confirmed",
    "already_cancelled",
    "already_expired",
    "not_found",
    "invalid_state",
  ]),
  order: orderSchema.nullable(),
});

export const fulfillmentMutationSchema = z.object({
  outcome: z.enum([
    "updated",
    "unchanged",
    "invalid_transition",
    "invalid_order_state",
    "not_found",
  ]),
  order: orderSchema.nullable(),
});

export const shopSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string(),
    slug: z.string(),
    active: z.boolean(),
    accepting_orders: z.boolean(),
    catalog_source_shop_id: z.string().uuid().nullable().optional(),
  })
  .passthrough();

export const shopMembershipSchema = z
  .object({
    shop_id: z.string().min(1),
    shop_name: z.string(),
    shop_slug: z.string(),
    role: z.enum(["owner", "admin", "staff"]),
    active: z.boolean(),
    shop_active: z.boolean(),
  })
  .passthrough();

export const shopListSchema = z.array(shopSchema);
export const shopMembershipListSchema = z.array(shopMembershipSchema);

export const shopWorkspaceSummarySchema = z
  .object({
    shop_id: z.string().min(1),
    shop_name: z.string(),
    shop_slug: z.string(),
    booth_name: z.string().nullish(),
    logo_url: z.string().nullish(),
    theme_background: z.string().nullish(),
  })
  .passthrough();

export const staffAccessSchema = z
  .object({
    shop_id: z.string().min(1).optional(),
    user_id: z.string().min(1).optional(),
    email: z.string().email().optional(),
    role: z.enum(["owner", "admin", "staff"]),
    active: z.boolean(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .passthrough();

export const staffAccessListSchema = z.array(staffAccessSchema);

export const shopInvitationSchema = z
  .object({
    id: z.string().min(1),
    shop_id: z.string().min(1),
    email: z.string().email(),
    role: z.enum(["owner", "admin", "staff"]),
    status: z.enum(["pending", "accepted", "revoked", "expired"]),
    expires_at: z.string(),
    created_at: z.string(),
  })
  .passthrough();

export const shopInvitationListSchema = z.array(shopInvitationSchema);
export const invitationOutcomeSchema = z.object({
  outcome: z.literal("processed"),
});

export const pushStatusResultSchema = z.object({ enabled: z.boolean() });
export const pushRegisterResultSchema = z.object({
  outcome: z.literal("registered"),
});
export const pushUnregisterResultSchema = z.object({
  outcome: z.literal("unregistered"),
  unsubscribe: z.boolean(),
});

export const productCategoryRowsSchema = z.array(
  z.object({ category: z.string() }).passthrough(),
);

export const promotionProductMappingsSchema = z.array(
  z
    .object({
      product_id: z.string().min(1),
      role: z.enum(["qualifying", "reward", "both"]),
    })
    .passthrough(),
);

export const imagePathsRowSchema = z
  .object({ image_paths: z.unknown().optional() })
  .passthrough();
export const imagePathsRowsSchema = z.array(imagePathsRowSchema);

const cachedOrderItemSchema = z
  .object({
    id: z.string().min(1),
    order_id: z.string().min(1),
    product_id: z.string().min(1),
    quantity: z.coerce.number().int().positive(),
    unit_price: z.coerce.number().int().nonnegative(),
    discount_amount: z.coerce.number().int().nonnegative().optional(),
    free_quantity: z.coerce.number().int().nonnegative().optional(),
    product: orderItemProductSchema.optional(),
  })
  .passthrough();

export const cachedAdminOrderSchema = orderSchema
  .extend({
    id: z.string().min(1),
    updated_at: z.string(),
    expires_at: z.string().nullable(),
    confirmed_at: z.string().nullable(),
    cancelled_at: z.string().nullable(),
    expired_at: z.string().nullable(),
    order_items: z.array(cachedOrderItemSchema).optional(),
    source: z.enum(["online", "offline_event"]).optional(),
    payment_method: z.enum(["cash", "vietqr"]).optional(),
    payment_state: z
      .enum([
        "awaiting_payment",
        "cash_confirmed",
        "bank_verification_pending",
        "bank_confirmed",
      ])
      .optional(),
  })
  .passthrough();

export const storefrontBootstrapSchema = z.object({
  shop: shopSchema,
  catalog_shop_id: z.string().min(1),
  products: z.array(productRowSchema).max(24),
  has_more: z.boolean(),
  booth: boothSettingsSchema.nullable(),
  categories: z.array(z.string().min(1).max(160)).max(500),
  promotion: promotionSettingsSchema,
  gacha_enabled: z.boolean(),
});
