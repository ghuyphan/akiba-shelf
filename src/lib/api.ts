import { defaultBooth, defaultPayment, defaultPromotion } from "./constants";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "./supabase";
import { safeUuid } from "./id";
import {
  ADMIN_PAYMENT_COLUMNS,
  PUBLIC_BOOTH_COLUMNS,
  PUBLIC_PAYMENT_COLUMNS,
  PUBLIC_PRODUCT_COLUMNS,
} from "./catalogQueries";
import { safePublicUrl } from "./branding";
import { getAppUrl } from "./authUrls";
import { LIMITED_STOCK_THRESHOLD } from "./constants";
import {
  boothSettingsSchema,
  orderItemProductSchema,
  orderMutationSchema,
  orderSchema,
  orderStatusCountsSchema,
  paymentSettingsSchema,
  promotionSettingsSchema,
  productRowSchema,
} from "./schemas";
import type {
  BoothSettings,
  CatalogData,
  PaymentSettings,
  PromotionSettings,
  Product,
  StockStatus,
  Order,
  OrderItemProduct,
  OrderStatus,
  CartItem,
  OrderMutationResult,
  Shop,
  ShopMembership,
} from "../types/catalog";
import type {
  GachaBanner,
  GachaCatalog,
  GachaElement,
  GachaGameConfiguration,
  GachaGameConfigurations,
  GachaGameType,
  GachaItemKind,
  GachaLiveStatus,
  GachaPoolEntry,
  GachaPoolItem,
  GachaRarity,
  GachaSettings,
  GachaWeaponType,
} from "../types/gacha";
import { defaultGachaBanner, defaultGachaSettings } from "../types/gacha";
import {
  capGachaFeaturedEntries,
  normalizeGachaBanners,
  normalizeGachaDisplayLimit,
} from "./gachaLimits";

export type StaffRole = "owner" | "admin" | "staff";
export type StaffAccess = {
  shop_id?: string;
  user_id?: string;
  email?: string;
  role: StaffRole;
  active: boolean;
  created_at?: string;
  updated_at?: string;
};
export type ShopInvitation = {
  id: string;
  shop_id: string;
  email: string;
  role: StaffRole;
  status: "pending" | "accepted" | "revoked" | "expired";
  expires_at: string;
  created_at: string;
};

const stockStatuses: StockStatus[] = ["in_stock", "limited", "sold_out"];

function text(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function numberValue(value: unknown, fallback = 0) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function booleanValue(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function textArray(value: unknown) {
  if (Array.isArray(value))
    return value.filter((item): item is string => typeof item === "string");
  if (typeof value === "string" && value.trim()) return [value];
  return [];
}

function stockStatus(value: unknown): StockStatus {
  return stockStatuses.includes(value as StockStatus)
    ? (value as StockStatus)
    : "in_stock";
}

function inferQuantity(product: Product) {
  if (Number.isFinite(product.quantity_available))
    return product.quantity_available;
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
    sale_price_vnd: product.sale_price_vnd == null ? null : numberValue(product.sale_price_vnd),
    effective_price_vnd: product.effective_price_vnd == null ? undefined : numberValue(product.effective_price_vnd),
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
          )
            return [];
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

function normalizePayment(payment: unknown): PaymentSettings {
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

function normalizeBooth(booth: unknown): BoothSettings {
  return {
    ...defaultBooth,
    ...boothSettingsSchema.parse(booth),
  };
}

function requireSupabase() {
  if (!supabase || !isSupabaseConfigured) {
    throw new Error(
      "Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.",
    );
  }

  return supabase;
}

export async function getPublicShop(slug: string): Promise<Shop | null> {
  const client = requireSupabase();
  const { data, error } = await client
    .from("shops")
    .select("id,name,slug,active,accepting_orders,catalog_source_shop_id")
    .eq("slug", slug.toLowerCase())
    .eq("active", true)
    .maybeSingle();
  if (error) throw error;
  return data as Shop | null;
}

export async function getCatalogCoreData(
  shopId: string,
): Promise<Pick<CatalogData, "products" | "booth">> {
  const boothRequest = getPublicBoothSettings(shopId);
  const products: Product[] = [];
  let hasMore = true;

  while (hasMore) {
    const page = await getPublicProducts(shopId, {
      offset: products.length,
      pageSize: 100,
    });
    products.push(...page.products);
    hasMore = page.hasMore;
  }

  return { products, booth: await boothRequest };
}

export type PublicProductSort =
  | "recommended"
  | "price-asc"
  | "price-desc"
  | "quantity"
  | "name";

export type PublicProductPage = {
  products: Product[];
  hasMore: boolean;
};

type PublicProductQuery = {
  offset?: number;
  pageSize?: number;
  category?: string;
  search?: string;
  sort?: PublicProductSort;
  signal?: AbortSignal;
};

function safeCatalogSearch(value: string) {
  return value
    .trim()
    .replace(/[\\"(),.%_*]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function getPublicProducts(
  shopId: string,
  {
    offset = 0,
    pageSize = 24,
    category,
    search = "",
    sort = "recommended",
    signal,
  }: PublicProductQuery = {},
): Promise<PublicProductPage> {
  const client = requireSupabase();
  let query = client
    .from("products")
    .select(PUBLIC_PRODUCT_COLUMNS)
    .eq("shop_id", shopId)
    .eq("active", true);

  if (category && category !== "All") query = query.eq("category", category);

  const searchTerm = safeCatalogSearch(search);
  if (searchTerm) {
    const pattern = `*${searchTerm}*`;
    query = query.or(
      `name.ilike.${pattern},item_code.ilike.${pattern},collection.ilike.${pattern},description.ilike.${pattern}`,
    );
  }

  if (sort === "price-asc") {
    query = query.order("effective_price_vnd", { ascending: true });
  } else if (sort === "price-desc") {
    query = query.order("effective_price_vnd", { ascending: false });
  } else if (sort === "quantity") {
    query = query.order("quantity_available", { ascending: false });
  } else if (sort === "name") {
    query = query.order("name", { ascending: true });
  } else {
    query = query
      .order("featured", { ascending: false })
      .order("sort_order", { ascending: true });
  }

  const safeOffset = Math.max(0, offset);
  const safePageSize = Math.max(1, Math.min(pageSize, 100));
  const rangedQuery = query
    .order("id", { ascending: true })
    .range(safeOffset, safeOffset + safePageSize);
  const { data, error } = await (signal
    ? rangedQuery.abortSignal(signal)
    : rangedQuery);
  if (error) throw error;
  const rows = ((data ?? []) as unknown[]).map((row) =>
    normalizeProduct(productRowSchema.parse(row)),
  );
  return {
    products: rows.slice(0, safePageSize),
    hasMore: rows.length > safePageSize,
  };
}

export async function getPublicFeaturedProducts(
  shopId: string,
  limit = 8,
): Promise<Product[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from("products")
    .select(PUBLIC_PRODUCT_COLUMNS)
    .eq("shop_id", shopId)
    .eq("active", true)
    .eq("featured", true)
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return ((data ?? []) as unknown[]).map((row) =>
    normalizeProduct(productRowSchema.parse(row)),
  );
}

export async function getPublicProductCategories(
  shopId: string,
): Promise<string[]> {
  const client = requireSupabase();
  const { data, error } = await client.rpc("get_public_product_categories", {
    p_shop_id: shopId,
  });
  if (error) throw error;
  return ((data ?? []) as { category: string }[]).map((row) => row.category);
}

export async function getPublicProductsByIds(
  shopId: string,
  productIds: string[],
): Promise<Product[]> {
  if (productIds.length === 0) return [];
  const client = requireSupabase();
  const { data, error } = await client
    .from("products")
    .select(PUBLIC_PRODUCT_COLUMNS)
    .eq("shop_id", shopId)
    .eq("active", true)
    .in("id", productIds);
  if (error) throw error;
  return ((data ?? []) as unknown[]).map((row) =>
    normalizeProduct(productRowSchema.parse(row)),
  );
}

const GACHA_SETTINGS_COLUMNS =
  "shop_id,enabled,game_type,title,description,rare_base_rate,legendary_base_rate,lightcone_legendary_base_rate,rare_soft_pity,legendary_soft_pity,lightcone_legendary_soft_pity,featured_item_rate,featured_guaranteed_after_loss,rare_pity,legendary_pity,lightcone_legendary_pity,updated_at";
const GACHA_BANNER_COLUMNS =
  "id,shop_id,name,description,kind,theme,display_limit,sort_order,active,starts_at,ends_at,updated_at";
const GACHA_POOL_COLUMNS =
  "shop_id,banner_id,product_id,kind,element,weapon_type,rarity,weight,featured,active,updated_at";

function normalizeGachaSettings(
  value: Record<string, unknown>,
  shopId: string,
): GachaSettings {
  const defaults = defaultGachaSettings(shopId);
  const rarePity = Math.min(
    30,
    Math.max(2, numberValue(value.rare_pity, defaults.rare_pity)),
  );
  const legendaryPity = Math.min(
    100,
    Math.max(10, numberValue(value.legendary_pity, defaults.legendary_pity)),
  );
  const lightconePity = Math.min(
    100,
    Math.max(
      10,
      numberValue(
        value.lightcone_legendary_pity,
        defaults.lightcone_legendary_pity,
      ),
    ),
  );
  return {
    shop_id: text(value.shop_id, shopId),
    enabled: booleanValue(value.enabled),
    game_type: (value.game_type === "hsr" ? "hsr" : "genshin") as "genshin" | "hsr",
    title: text(value.title, defaults.title),
    description: text(value.description, defaults.description),
    rare_base_rate: Math.min(
      99.99,
      Math.max(0.01, numberValue(value.rare_base_rate, defaults.rare_base_rate)),
    ),
    legendary_base_rate: Math.min(
      99.99,
      Math.max(
        0.01,
        numberValue(value.legendary_base_rate, defaults.legendary_base_rate),
      ),
    ),
    lightcone_legendary_base_rate: Math.min(
      99.99,
      Math.max(
        0.01,
        numberValue(
          value.lightcone_legendary_base_rate,
          defaults.lightcone_legendary_base_rate,
        ),
      ),
    ),
    rare_soft_pity: Math.min(
      rarePity - 1,
      Math.max(1, numberValue(value.rare_soft_pity, rarePity - 1)),
    ),
    legendary_soft_pity: Math.min(
      legendaryPity - 1,
      Math.max(1, numberValue(value.legendary_soft_pity, legendaryPity - 1)),
    ),
    lightcone_legendary_soft_pity: Math.min(
      lightconePity - 1,
      Math.max(
        1,
        numberValue(
          value.lightcone_legendary_soft_pity,
          lightconePity - 1,
        ),
      ),
    ),
    featured_item_rate: Math.min(
      100,
      Math.max(
        0,
        numberValue(value.featured_item_rate, defaults.featured_item_rate),
      ),
    ),
    featured_guaranteed_after_loss: booleanValue(
      value.featured_guaranteed_after_loss,
      defaults.featured_guaranteed_after_loss,
    ),
    rare_pity: rarePity,
    legendary_pity: legendaryPity,
    lightcone_legendary_pity: lightconePity,
    updated_at: text(value.updated_at) || undefined,
  };
}

function normalizeGachaBanner(
  value: Record<string, unknown>,
  shopId: string,
  gameType: GachaGameType = "genshin",
): GachaBanner {
  const defaults = defaultGachaBanner(shopId, text(value.id));
  return {
    id: text(value.id, defaults.id),
    shop_id: text(value.shop_id, shopId),
    name: text(value.name, defaults.name),
    description: text(value.description, defaults.description),
    kind: (value.kind === "weapon" || value.kind === "lightcone" ? value.kind : "character") as GachaItemKind,
    theme: ([
      "anemo", "geo", "electro", "dendro", "hydro", "pyro", "cryo",
      "physical", "fire", "ice", "lightning", "wind", "quantum", "imaginary"
    ].includes(text(value.theme))
      ? text(value.theme)
      : defaults.theme) as GachaElement,
    display_limit: normalizeGachaDisplayLimit(
      numberValue(value.display_limit, defaults.display_limit),
      gameType,
    ),
    sort_order: Math.min(
      1000,
      Math.max(0, numberValue(value.sort_order, defaults.sort_order)),
    ),
    active: booleanValue(value.active, true),
    starts_at: text(value.starts_at) || null,
    ends_at: text(value.ends_at) || null,
    updated_at: text(value.updated_at) || undefined,
  };
}

function normalizeGachaPoolEntry(
  value: Record<string, unknown>,
  shopId: string,
): GachaPoolEntry {
  const rarity = numberValue(value.rarity, 3);
  return {
    shop_id: text(value.shop_id, shopId),
    banner_id: text(value.banner_id),
    product_id: text(value.product_id),
    kind: (value.kind === "weapon" || value.kind === "lightcone" ? value.kind : "character") as GachaItemKind,
    element: ([
      "anemo", "geo", "electro", "dendro", "hydro", "pyro", "cryo",
      "physical", "fire", "ice", "lightning", "wind", "quantum", "imaginary"
    ].includes(text(value.element))
      ? text(value.element)
      : "anemo") as GachaElement,
    weapon_type: ([
      "sword", "claymore", "polearm", "bow", "catalyst",
      "destruction", "hunt", "erudition", "harmony", "nihility", "preservation", "abundance"
    ].includes(text(value.weapon_type))
      ? text(value.weapon_type)
      : "sword") as GachaWeaponType,
    rarity: (rarity === 4 || rarity === 5 ? rarity : 3) as GachaRarity,
    weight: Math.min(1000, Math.max(1, numberValue(value.weight, 100))),
    featured: booleanValue(value.featured),
    active: booleanValue(value.active, true),
    updated_at: text(value.updated_at) || undefined,
  };
}

function normalizeStoredGameConfiguration(
  value: unknown,
  shopId: string,
  gameType: GachaGameType,
): GachaGameConfiguration | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const rawSettings =
    record.settings && typeof record.settings === "object"
      ? (record.settings as Record<string, unknown>)
      : {};
  const settings = normalizeGachaSettings(
    { ...rawSettings, game_type: gameType },
    shopId,
  );
  const banners = Array.isArray(record.banners)
    ? record.banners.map((banner) =>
        normalizeGachaBanner(banner as Record<string, unknown>, shopId, gameType),
      )
    : [];
  const entries = Array.isArray(record.entries)
    ? record.entries.map((entry) =>
        normalizeGachaPoolEntry(entry as Record<string, unknown>, shopId),
      )
    : [];
  return {
    settings,
    banners,
    entries: capGachaFeaturedEntries(entries, banners, gameType),
  };
}

export async function getGachaCatalog(
  shopId: string,
): Promise<GachaCatalog> {
  const client = requireSupabase();
  const [settingsResult, bannersResult, poolResult] = await Promise.all([
    client
      .from("gacha_settings")
      .select(GACHA_SETTINGS_COLUMNS)
      .eq("shop_id", shopId)
      .maybeSingle(),
    client
      .from("gacha_banners")
      .select(GACHA_BANNER_COLUMNS)
      .eq("shop_id", shopId)
      .eq("active", true)
      .order("sort_order", { ascending: true })
      .order("id", { ascending: true }),
    client
      .from("gacha_pool_entries")
      .select(GACHA_POOL_COLUMNS)
      .eq("shop_id", shopId)
      .eq("active", true)
      .order("rarity", { ascending: false })
      .order("product_id", { ascending: true }),
  ]);
  if (settingsResult.error) throw settingsResult.error;
  if (bannersResult.error) throw bannersResult.error;
  if (poolResult.error) throw poolResult.error;
  const entries = ((poolResult.data ?? []) as Record<string, unknown>[]).map(
    (row) => normalizeGachaPoolEntry(row, shopId),
  );
  const products = await getPublicProductsByIds(
    shopId,
    entries.map((entry) => entry.product_id),
  );
  const productsById = new Map(products.map((product) => [product.id, product]));
  const settings = settingsResult.data
      ? normalizeGachaSettings(
          settingsResult.data as Record<string, unknown>,
          shopId,
        )
      : null;
  const gameType = settings?.game_type ?? "genshin";
  const banners = ((bannersResult.data ?? []) as Record<string, unknown>[]).map(
    (row) => normalizeGachaBanner(row, shopId, gameType),
  );
  return {
    settings,
    banners,
    entries: entries.flatMap((entry): GachaPoolItem[] => {
      const product = productsById.get(entry.product_id);
      return product ? [{ ...entry, product }] : [];
    }),
  };
}

export async function getPublicGachaEnabled(shopId: string): Promise<boolean> {
  const { data, error } = await requireSupabase()
    .from("gacha_settings")
    .select("enabled")
    .eq("shop_id", shopId)
    .maybeSingle();
  if (error) throw error;
  return data?.enabled === true;
}

/**
 * Loads the admin gacha workspace: both games' editor drafts plus the
 * currently published ("live") status. Drafts are the only admin-side store;
 * the relational tables are the public projection written by publishing.
 * Games without a stored draft seed from defaults.
 */
export async function getAdminGachaConfiguration(shopId: string): Promise<{
  configurations: GachaGameConfigurations;
  live: GachaLiveStatus | null;
}> {
  const client = requireSupabase();
  const [configsResult, settingsResult, bannersResult, entriesResult] =
    await Promise.all([
      client
        .from("gacha_game_configs")
        .select("game_type,config")
        .eq("shop_id", shopId),
      client
        .from("gacha_settings")
        .select(GACHA_SETTINGS_COLUMNS)
        .eq("shop_id", shopId)
        .maybeSingle(),
      client
        .from("gacha_banners")
        .select("id", { count: "exact", head: true })
        .eq("shop_id", shopId)
        .eq("active", true),
      client
        .from("gacha_pool_entries")
        .select("product_id", { count: "exact", head: true })
        .eq("shop_id", shopId)
        .eq("active", true),
    ]);
  if (configsResult.error) throw configsResult.error;
  if (settingsResult.error) throw settingsResult.error;
  if (bannersResult.error) throw bannersResult.error;
  if (entriesResult.error) throw entriesResult.error;

  const storedConfigs = Object.fromEntries(
    ((configsResult.data ?? []) as { game_type: string; config: unknown }[])
      .filter((row) => row.game_type === "genshin" || row.game_type === "hsr")
      .map((row) => [row.game_type, row.config]),
  );
  const configurations = (["genshin", "hsr"] as GachaGameType[]).reduce<
    GachaGameConfigurations
  >((configs, gameType) => {
    configs[gameType] =
      normalizeStoredGameConfiguration(storedConfigs[gameType], shopId, gameType) ??
      {
        settings: { ...defaultGachaSettings(shopId), game_type: gameType },
        banners: [],
        entries: [],
      };
    return configs;
  }, {});

  const live: GachaLiveStatus | null = settingsResult.data
    ? {
        settings: normalizeGachaSettings(
          settingsResult.data as Record<string, unknown>,
          shopId,
        ),
        bannerCount: bannersResult.count ?? 0,
        entryCount: entriesResult.count ?? 0,
      }
    : null;
  return { configurations, live };
}

/**
 * Normalizes a draft before persistence: trims copy, clamps display limits to
 * the game's rules, and caps featured flags. Shared by draft saving and
 * publishing so the stored draft and the RPC payload never diverge.
 */
function normalizedDraftConfig(
  shopId: string,
  gameType: GachaGameType,
  config: GachaGameConfiguration,
): GachaGameConfiguration {
  const banners = normalizeGachaBanners(config.banners, gameType);
  return {
    settings: {
      ...config.settings,
      shop_id: shopId,
      game_type: gameType,
      title: config.settings.title.trim(),
      description: config.settings.description.trim(),
    },
    banners,
    entries: capGachaFeaturedEntries(config.entries, banners, gameType),
  };
}

/** Persists one game's editor draft. Drafts never affect the storefront. */
export async function saveGachaDraft(
  shopId: string,
  gameType: GachaGameType,
  config: GachaGameConfiguration,
): Promise<GachaGameConfiguration> {
  const draft = normalizedDraftConfig(shopId, gameType, config);
  const { error } = await requireSupabase()
    .from("gacha_game_configs")
    .upsert(
      { shop_id: shopId, game_type: gameType, config: draft },
      { onConflict: "shop_id,game_type" },
    );
  if (error) throw error;
  return draft;
}

/**
 * Saves the draft, then atomically replaces the published configuration for
 * the shop via the publish RPC (which also switches the live game). If the
 * RPC rejects the payload the draft remains saved.
 */
export async function publishGachaConfiguration(
  shopId: string,
  gameType: GachaGameType,
  config: GachaGameConfiguration,
): Promise<GachaGameConfiguration> {
  const draft = await saveGachaDraft(shopId, gameType, config);
  const { error } = await requireSupabase().rpc("publish_gacha_configuration_v4", {
    p_shop_id: shopId,
    p_game_type: gameType,
    p_config: {
      settings: draft.settings,
      banners: draft.banners.map((banner) => ({
        id: banner.id,
        name: banner.name,
        description: banner.description,
        kind: banner.kind,
        theme: banner.theme,
        display_limit: banner.display_limit,
        active: banner.active,
        starts_at: banner.starts_at,
        ends_at: banner.ends_at,
      })),
      entries: draft.entries.map((entry) => ({
        banner_id: entry.banner_id,
        product_id: entry.product_id,
        kind: entry.kind,
        element: entry.element,
        weapon_type: entry.weapon_type,
        rarity: entry.rarity,
        weight: entry.weight,
        featured: entry.featured,
        active: entry.active,
      })),
    },
  });
  if (error) throw error;
  return draft;
}

export async function getPublicBoothSettings(
  shopId: string,
): Promise<BoothSettings> {
  const client = requireSupabase();
  const { data, error } = await client
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
  const client = requireSupabase();
  const { data, error } = await client
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
    client.from("promotions").select("shop_id,enabled,buy_quantity,free_quantity,repeatable").eq("shop_id", shopId).maybeSingle(),
    client.from("promotion_products").select("product_id,role").eq("shop_id", shopId),
  ]);
  if (promotion.error) throw promotion.error;
  if (mappings.error) throw mappings.error;
  const rows = (mappings.data ?? []) as { product_id: string; role: "qualifying" | "reward" | "both" }[];
  return normalizePromotion({
    ...(promotion.data ?? { ...defaultPromotion, shop_id: shopId }),
    qualifying_product_ids: rows.filter((row) => row.role === "qualifying" || row.role === "both").map((row) => row.product_id),
    reward_product_ids: rows.filter((row) => row.role === "reward" || row.role === "both").map((row) => row.product_id),
  });
}

export async function getCatalogData(shopId: string): Promise<CatalogData> {
  const [catalog, payment, promotion] = await Promise.all([
    getCatalogCoreData(shopId),
    getPublicPaymentSettings(shopId),
    getPublicPromotionSettings(shopId),
  ]);
  return { ...catalog, payment, promotion };
}

export async function getAdminProducts(shopId: string): Promise<Product[]> {
  const client = requireSupabase();
  const { data, error } = await client.rpc("get_admin_products", {
    p_shop_id: shopId,
  });
  if (error) throw error;
  return ((data ?? []) as unknown[]).map((row) =>
    normalizeProduct(productRowSchema.parse(row)),
  );
}

export async function getAdminCatalogData(
  shopId: string,
): Promise<CatalogData> {
  const client = requireSupabase();

  const [products, booth, payment, promotion, promotionProducts] = await Promise.all([
    client.rpc("get_admin_products", { p_shop_id: shopId }),
    client.rpc("get_admin_booth_settings", { p_shop_id: shopId }).maybeSingle(),
    client
      .from("payment_settings")
      .select(ADMIN_PAYMENT_COLUMNS)
      .eq("shop_id", shopId)
      .maybeSingle(),
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

  if (products.error) throw products.error;
  if (booth.error) throw booth.error;
  if (payment.error) throw payment.error;
  if (promotion.error) throw promotion.error;
  if (promotionProducts.error) throw promotionProducts.error;
  const promotionRows = (promotionProducts.data ?? []) as { product_id: string; role: "qualifying" | "reward" | "both" }[];

  return {
    products: ((products.data ?? []) as unknown[]).map((row) =>
      normalizeProduct(productRowSchema.parse(row)),
    ),
    booth: normalizeBooth(booth.data ?? { ...defaultBooth, shop_id: shopId }),
    payment: normalizePayment(payment.data ?? defaultPayment),
    promotion: normalizePromotion(
      {
        ...(promotion.data ?? { ...defaultPromotion, shop_id: shopId }),
        qualifying_product_ids: promotionRows.filter((row) => row.role === "qualifying" || row.role === "both").map((row) => row.product_id),
        reward_product_ids: promotionRows.filter((row) => row.role === "reward" || row.role === "both").map((row) => row.product_id),
      },
    ),
  };
}

export async function getShopWorkspaceSummary(
  shopId: string,
): Promise<
  Pick<Shop, "id" | "name" | "slug"> &
    Pick<BoothSettings, "booth_name" | "logo_url" | "theme_background">
> {
  const client = requireSupabase();
  const { data, error } = await client
    .rpc("get_shop_workspace_summary", { p_shop_id: shopId })
    .single();
  if (error) throw error;
  const summary = data as {
    shop_id: string;
    shop_name: string;
    shop_slug: string;
    booth_name?: string;
    logo_url?: string;
    theme_background?: string;
  };
  return {
    id: summary.shop_id,
    name: summary.shop_name,
    slug: summary.shop_slug,
    booth_name: summary.booth_name ?? summary.shop_name,
    logo_url: summary.logo_url ?? "",
    theme_background: summary.theme_background ?? defaultBooth.theme_background,
  };
}

// Read one product's private storage paths through the member-safe RPC so the
// browser never needs SELECT on image_paths (hardened column grants deny it).
async function getProductImagePaths(
  client: ReturnType<typeof requireSupabase>,
  shopId: string,
  productId: string,
): Promise<string[] | null> {
  const { data, error } = await client
    .rpc("get_admin_products", { p_shop_id: shopId })
    .select("image_paths")
    .eq("id", productId)
    .maybeSingle();
  if (error) throw error;
  return data
    ? textArray((data as { image_paths?: unknown }).image_paths)
    : null;
}

export async function saveProduct(
  shopId: string,
  product: Product,
): Promise<Product> {
  const client = requireSupabase();
  const previousPaths = await getProductImagePaths(client, shopId, product.id);
  const editableProduct = { ...product };
  delete editableProduct.effective_price_vnd;
  const payload = { ...editableProduct, shop_id: shopId };
  // Do not collapse these into an upsert. ON CONFLICT reads every proposed
  // update column, while hardened grants intentionally deny browser SELECT
  // access to private storage metadata such as image_paths.
  const write = previousPaths
    ? client
        .from("products")
        .update(payload)
        .eq("id", product.id)
        .eq("shop_id", shopId)
    : client.from("products").insert(payload);
  const { data, error } = await write
    .select(PUBLIC_PRODUCT_COLUMNS)
    .single();
  if (error) throw error;
  const removedPaths = (previousPaths ?? []).filter(
    (path) => !textArray(product.image_paths).includes(path),
  );
  if (removedPaths.length)
    await removeUnreferencedProductImages(client, shopId, removedPaths);
  return normalizeProduct(
    productRowSchema.parse({ ...data, image_paths: product.image_paths }),
  );
}

async function removeUnreferencedProductImages(
  client: ReturnType<typeof requireSupabase>,
  shopId: string,
  paths: string[],
) {
  // Targeted overlap query: only products still referencing these paths come
  // back, instead of transferring the entire catalog for a reference check.
  const { data, error } = await client
    .rpc("get_admin_products", { p_shop_id: shopId })
    .select("image_paths")
    .overlaps("image_paths", paths);
  if (error) throw error;
  const referenced = new Set(
    ((data ?? []) as { image_paths?: unknown }[]).flatMap((row) =>
      textArray(row.image_paths),
    ),
  );
  const removable = paths.filter((path) => !referenced.has(path));
  if (removable.length) {
    const { error: removeError } = await client.storage
      .from("product-images")
      .remove(removable);
    if (removeError) throw removeError;
  }
}

export async function deleteProduct(shopId: string, id: string) {
  const client = requireSupabase();
  const paths = await getProductImagePaths(client, shopId, id);
  if (!paths) throw new Error("Product not found.");
  const { error } = await client
    .from("products")
    .delete()
    .eq("shop_id", shopId)
    .eq("id", id);
  if (error) throw error;
  if (paths.length)
    await removeUnreferencedProductImages(client, shopId, paths);
}

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
  // Booth storage paths are private. An upsert would require SELECT access to
  // every proposed update column, conflicting with the hardened column grants.
  const write = previous
    ? client
        .from("booth_settings")
        .update(payload)
        .eq("shop_id", shopId)
    : client.from("booth_settings").insert(payload);
  const { data, error } = await write
    .select(PUBLIC_BOOTH_COLUMNS)
    .single();
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
    ? client
        .from("payment_settings")
        .update(payload)
        .eq("shop_id", shopId)
    : client.from("payment_settings").insert(payload);
  const { data, error } = await write
    .select(ADMIN_PAYMENT_COLUMNS)
    .single();
  if (error) throw error;
  return normalizePayment(data);
}

export async function savePromotionSettings(
  shopId: string,
  promotion: PromotionSettings,
): Promise<PromotionSettings> {
  const client = requireSupabase();
  const normalized = normalizePromotion({ ...promotion, shop_id: shopId });
  const { error } = await client.rpc("save_promotion_settings", {
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

export async function uploadImage(
  shopId: string,
  bucket: string,
  file: File,
): Promise<{ url: string; path: string }> {
  const client = requireSupabase();

  const extension = file.name.split(".").pop() ?? "png";
  const path = `${shopId}/${safeUuid()}.${extension}`;
  const { error } = await client.storage.from(bucket).upload(path, file, {
    upsert: false,
    contentType: file.type,
    cacheControl: "31536000",
  });
  if (error) throw error;

  const { data } = client.storage.from(bucket).getPublicUrl(path);
  return { url: data.publicUrl, path };
}

export async function uploadProductImages(
  shopId: string,
  thumbnail: File,
  detail: File,
) {
  if (thumbnail.type !== "image/webp" || detail.type !== "image/webp") {
    throw new Error("Product image variants must be WebP files.");
  }
  const client = requireSupabase();
  const id = safeUuid();
  const uploadedPaths: string[] = [];
  async function upload(suffix: string, file: File) {
    const path = `${shopId}/${id}-${suffix}.webp`;
    const { error } = await client.storage
      .from("product-images")
      .upload(path, file, {
        upsert: false,
        contentType: "image/webp",
        cacheControl: "31536000",
      });
    if (error) throw error;
    uploadedPaths.push(path);
    return client.storage.from("product-images").getPublicUrl(path).data
      .publicUrl;
  }
  try {
    const thumbnailUrl = await upload("thumb", thumbnail);
    const detailUrl = await upload("detail", detail);
    return {
      thumbnail: thumbnailUrl,
      detail: detailUrl,
      paths: [...uploadedPaths],
    };
  } catch (error) {
    if (uploadedPaths.length)
      await client.storage.from("product-images").remove(uploadedPaths);
    throw error;
  }
}

export async function signInAdmin(email: string, password: string) {
  const client = requireSupabase();

  const { data, error } = await client.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  return data;
}

export async function signInWithGoogle() {
  const client = requireSupabase();
  const { data, error } = await client.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: getAppUrl("/auth/callback"),
    },
  });
  if (error) throw error;
  return data;
}

export async function signOutAdmin() {
  const client = requireSupabase();

  const { error } = await client.auth.signOut();
  if (error) throw error;
}

export async function getShopMemberships(): Promise<ShopMembership[]> {
  const client = requireSupabase();
  const { data, error } = await client.rpc("get_my_shop_memberships");
  if (error) throw error;
  return (data ?? []) as ShopMembership[];
}

export async function getStaffMembers(shopId: string): Promise<StaffAccess[]> {
  const client = requireSupabase();
  const { data, error } = await client.rpc("get_shop_members", {
    p_shop_id: shopId,
  });
  if (error) throw error;
  return (data ?? []) as StaffAccess[];
}

export async function saveStaffMember(
  shopId: string,
  member: { user_id: string; role: StaffRole; active: boolean },
) {
  const client = requireSupabase();
  const { data, error } = await client.rpc("save_shop_member", {
    p_shop_id: shopId,
    p_user_id: member.user_id,
    p_role: member.role,
    p_active: member.active,
  });
  if (error) throw error;
  return data as StaffAccess;
}

export async function deleteStaffMember(shopId: string, userId: string) {
  const client = requireSupabase();
  const { error } = await client.rpc("delete_shop_member", {
    p_shop_id: shopId,
    p_user_id: userId,
  });
  if (error) throw error;
}

async function handleFunctionsError(error: unknown): Promise<never> {
  if (error instanceof FunctionsHttpError) {
    try {
      const body = await error.context.json();
      if (body && typeof body === "object" && typeof body.error === "string") {
        throw new Error(body.error);
      }
    } catch (caught) {
      if (caught instanceof Error && caught.message !== "Could not reach the invitation service.") {
        throw caught;
      }
    }
  }
  throw new Error("Could not reach the invitation service.");
}

export type InvitationOutcome = "processed";
export async function inviteShopMember(
  shopId: string,
  email: string,
  role: StaffRole,
): Promise<InvitationOutcome> {
  const client = requireSupabase();
  const { data, error } = await client.functions.invoke("invite-shop-member", {
    body: { action: "invite", shopId, email, role },
  });
  if (error) {
    await handleFunctionsError(error);
  }
  if ((data as { outcome?: string })?.outcome !== "processed")
    throw new Error("Invitation response was invalid.");
  return "processed";
}

export async function getShopInvitations(
  shopId: string,
): Promise<ShopInvitation[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from("shop_invitations")
    .select("id,shop_id,email,role,status,expires_at,created_at")
    .eq("shop_id", shopId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ShopInvitation[];
}

export async function updateShopInvitation(
  shopId: string,
  invitationId: string,
  action: "resend" | "revoke",
): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.functions.invoke("invite-shop-member", {
    body: { action, shopId, invitationId },
  });
  if (error) {
    await handleFunctionsError(error);
  }
}

export async function createShop(name: string, slug: string): Promise<Shop> {
  const client = requireSupabase();
  const { data, error } = await client.rpc("create_shop", {
    p_name: name,
    p_slug: slug,
  });
  if (error) throw error;
  return data as Shop;
}

export async function createOrder(
  shopSlug: string,
  customerName: string | null,
  cart: CartItem[],
  clientRequestId: string,
  recoveryToken: string,
): Promise<Order> {
  const client = requireSupabase();
  const { data, error } = await client.rpc("create_order", {
    p_shop_slug: shopSlug,
    p_customer_name: customerName?.trim() || null,
    p_items: cart.map((item) => ({
      product_id: item.product.id,
      quantity: item.quantity + (item.reward_quantity ?? 0),
      reward_quantity: item.reward_quantity ?? 0,
    })),
    p_client_request_id: clientRequestId,
    p_recovery_token: recoveryToken,
  });
  if (error) throw error;
  const createdOrder = Array.isArray(data) ? data[0] : data;
  if (!createdOrder)
    throw new Error(
      "The order was created but no order details were returned.",
    );
  void client.functions
    .invoke("notify-new-order", {
      body: { orderId: createdOrder.id, recoveryToken },
    })
    .catch(() => undefined);
  return orderSchema.parse(createdOrder) as Order;
}

export async function getCustomerOrder(
  orderId: string,
  recoveryToken: string,
): Promise<Order | null> {
  const client = requireSupabase();
  const { data, error } = await client.rpc("get_customer_order", {
    p_order_id: orderId,
    p_recovery_token: recoveryToken,
  });
  if (error) throw error;
  const order = Array.isArray(data) ? data[0] : data;
  return order ? (orderSchema.parse(order) as Order) : null;
}

export type OrderFilter = OrderStatus | "all";
export type OrderStatusCounts = Record<OrderFilter, number>;

// The order queue only renders a line item's name, item code, and first image,
// so the nested product projection stays narrow instead of embedding the full
// 21-column public product shape on every row.
const ORDER_ITEM_PRODUCT_COLUMNS = "id,name,item_code,images";

function normalizeOrderItemProduct(row: unknown): OrderItemProduct {
  const parsed = orderItemProductSchema.parse(row);
  return {
    id: parsed.id,
    name: parsed.name,
    item_code: parsed.item_code,
    images: parsed.images.flatMap((value) => safePublicUrl(value) ?? []),
  };
}

export async function getOrders(
  shopId: string,
  {
    page = 1,
    pageSize = 12,
    status = "all",
    createdAfter,
    createdBefore,
  }: {
    page?: number;
    pageSize?: number;
    status?: OrderFilter;
    createdAfter?: string;
    createdBefore?: string;
  } = {},
): Promise<{ orders: Order[]; total: number }> {
  const client = requireSupabase();
  const from = Math.max(0, page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = client
    .from("orders")
    .select(
      `id,shop_id,order_code,customer_name,total_amount,discount_amount,status,created_at,updated_at,expires_at,confirmed_at,cancelled_at,expired_at,order_items(id,order_id,product_id,quantity,unit_price,free_quantity,discount_amount,product:products(${ORDER_ITEM_PRODUCT_COLUMNS}))`,
      { count: "exact" },
    )
    .eq("shop_id", shopId);

  if (status !== "all") query = query.eq("status", status);
  if (createdAfter) query = query.gte("created_at", createdAfter);
  if (createdBefore) query = query.lt("created_at", createdBefore);

  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(from, to);

  if (error) throw error;
  const orders = (data ?? []).map((row) => ({
    ...orderSchema.parse(row),
    order_items: (row.order_items ?? []).map((item) => ({
      ...item,
      product: Array.isArray(item.product)
        ? normalizeOrderItemProduct(item.product[0])
        : item.product
          ? normalizeOrderItemProduct(item.product)
          : undefined,
    })),
  })) as Order[];
  return { orders, total: count ?? 0 };
}

export async function getOrderStatusCounts(
  shopId: string,
  {
    createdAfter,
    createdBefore,
  }: {
    createdAfter?: string;
    createdBefore?: string;
  } = {},
): Promise<OrderStatusCounts> {
  const client = requireSupabase();
  const { data, error } = await client.rpc("get_order_status_counts", {
    p_shop_id: shopId,
    p_created_after: createdAfter ?? null,
    p_created_before: createdBefore ?? null,
  });
  if (error) throw error;
  return orderStatusCountsSchema.parse(data) as OrderStatusCounts;
}

export async function confirmOrderPayment(
  orderId: string,
): Promise<OrderMutationResult> {
  const client = requireSupabase();

  const { data, error } = await client.rpc("confirm_order_payment", {
    target_order_id: orderId,
  });
  if (error) throw error;
  return orderMutationSchema.parse(data) as unknown as OrderMutationResult;
}

export async function cancelOrder(
  orderId: string,
): Promise<OrderMutationResult> {
  const client = requireSupabase();

  const { data, error } = await client.rpc("cancel_order", {
    target_order_id: orderId,
  });
  if (error) throw error;
  return orderMutationSchema.parse(data) as unknown as OrderMutationResult;
}
export async function cancelCustomerOrder(
  orderId: string,
  recoveryToken: string,
): Promise<OrderMutationResult> {
  const client = requireSupabase();
  const { data, error } = await client.rpc("cancel_customer_order", {
    p_order_id: orderId,
    p_recovery_token: recoveryToken,
  });
  if (error) throw error;
  return orderMutationSchema.parse(data) as unknown as OrderMutationResult;
}

export async function updateShop(shopId: string, name: string): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.rpc("update_shop_details", {
    p_shop_id: shopId,
    p_name: name.trim(),
  });
  if (error) throw error;
}
