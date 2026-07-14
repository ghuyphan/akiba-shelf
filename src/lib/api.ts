import { defaultBooth, defaultPayment } from "./constants";
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
  orderMutationSchema,
  orderSchema,
  paymentSettingsSchema,
  productRowSchema,
} from "./schemas";
import type {
  BoothSettings,
  CatalogData,
  PaymentSettings,
  Product,
  StockStatus,
  Order,
  OrderStatus,
  CartItem,
  OrderMutationResult,
  Shop,
  ShopMembership,
} from "../types/catalog";

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

export async function getDefaultShop(): Promise<Shop | null> {
  return getPublicShop("akiba-shelf");
}

export async function getCatalogCoreData(
  shopId: string,
): Promise<Pick<CatalogData, "products" | "booth">> {
  const [products, booth] = await Promise.all([
    getPublicProducts(shopId),
    getPublicBoothSettings(shopId),
  ]);
  return { products, booth };
}

export async function getPublicProducts(shopId: string): Promise<Product[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from("products")
    .select(PUBLIC_PRODUCT_COLUMNS)
    .eq("shop_id", shopId)
    .eq("active", true)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as unknown[]).map((row) =>
    normalizeProduct(productRowSchema.parse(row)),
  );
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

export async function getCatalogData(shopId: string): Promise<CatalogData> {
  const [catalog, payment] = await Promise.all([
    getCatalogCoreData(shopId),
    getPublicPaymentSettings(shopId),
  ]);
  return { ...catalog, payment };
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

  const [products, booth, payment] = await Promise.all([
    client.rpc("get_admin_products", { p_shop_id: shopId }),
    client.rpc("get_admin_booth_settings", { p_shop_id: shopId }).maybeSingle(),
    client
      .from("payment_settings")
      .select(ADMIN_PAYMENT_COLUMNS)
      .eq("shop_id", shopId)
      .maybeSingle(),
  ]);

  if (products.error) throw products.error;
  if (booth.error) throw booth.error;
  if (payment.error) throw payment.error;

  return {
    products: ((products.data ?? []) as unknown[]).map((row) =>
      normalizeProduct(productRowSchema.parse(row)),
    ),
    booth: normalizeBooth(booth.data ?? { ...defaultBooth, shop_id: shopId }),
    payment: normalizePayment(payment.data ?? defaultPayment),
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

export async function saveProduct(
  shopId: string,
  product: Product,
): Promise<Product> {
  const client = requireSupabase();
  const previous = (await getAdminProducts(shopId)).find(
    (item) => item.id === product.id,
  );
  const payload = { ...product, shop_id: shopId };
  // Do not collapse these into an upsert. ON CONFLICT reads every proposed
  // update column, while hardened grants intentionally deny browser SELECT
  // access to private storage metadata such as image_paths.
  const write = previous
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
  const removedPaths = textArray(previous?.image_paths).filter(
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
  const references = await getAdminProducts(shopId);
  const referenced = new Set(
    references.flatMap((row) => textArray(row.image_paths)),
  );
  const removable = paths.filter((path) => !referenced.has(path));
  if (removable.length) {
    const { error } = await client.storage
      .from("product-images")
      .remove(removable);
    if (error) throw error;
  }
}

export async function deleteProduct(shopId: string, id: string) {
  const client = requireSupabase();
  const product = (await getAdminProducts(shopId)).find(
    (item) => item.id === id,
  );
  if (!product) throw new Error("Product not found.");
  const { error } = await client
    .from("products")
    .delete()
    .eq("shop_id", shopId)
    .eq("id", id);
  if (error) throw error;
  const paths = textArray(product.image_paths);
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
      quantity: item.quantity,
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

export async function getOrders(
  shopId: string,
  {
    page = 1,
    pageSize = 12,
    status = "all",
  }: { page?: number; pageSize?: number; status?: OrderFilter } = {},
): Promise<{ orders: Order[]; total: number }> {
  const client = requireSupabase();
  const from = Math.max(0, page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = client
    .from("orders")
    .select(
      `id,shop_id,order_code,customer_name,total_amount,status,created_at,updated_at,expires_at,confirmed_at,cancelled_at,expired_at,order_items(id,order_id,product_id,quantity,unit_price,product:products(${PUBLIC_PRODUCT_COLUMNS}))`,
      { count: "exact" },
    )
    .eq("shop_id", shopId);

  if (status !== "all") query = query.eq("status", status);

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
        ? normalizeProduct(productRowSchema.parse(item.product[0]))
        : item.product
          ? normalizeProduct(productRowSchema.parse(item.product))
          : undefined,
    })),
  })) as Order[];
  return { orders, total: count ?? 0 };
}

export async function getOrderStatusCounts(
  shopId: string,
): Promise<OrderStatusCounts> {
  const client = requireSupabase();
  const statuses: OrderStatus[] = [
    "pending",
    "confirmed",
    "cancelled",
    "expired",
  ];
  const counts = await Promise.all(
    statuses.map(async (status) => {
      const { count, error } = await client
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("shop_id", shopId)
        .eq("status", status);
      if (error) throw error;
      return [status, count ?? 0] as const;
    }),
  );
  const result = Object.fromEntries(counts) as Record<OrderStatus, number>;
  return {
    ...result,
    all: statuses.reduce((sum, status) => sum + result[status], 0),
  };
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
