import { defaultBooth, defaultPayment } from "./constants";
import { isSupabaseConfigured, supabase } from "./supabase";
import { safeUuid } from "./id";
import { BOOTH_COLUMNS, PAYMENT_COLUMNS, PRODUCT_COLUMNS } from "./catalogQueries";
import { LIMITED_STOCK_THRESHOLD } from "./constants";
import { boothSettingsSchema, orderMutationSchema, orderSchema, paymentSettingsSchema, productRowSchema } from "./schemas";
import type { BoothSettings, CatalogData, PaymentSettings, Product, StockStatus, Order, OrderStatus, CartItem, OrderMutationResult } from "../types/catalog";

export type StaffRole = "owner" | "admin" | "staff";
export type StaffAccess = { user_id?: string; role: StaffRole; active: boolean; created_at?: string; updated_at?: string };

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
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  if (typeof value === "string" && value.trim()) return [value];
  return [];
}

function stockStatus(value: unknown): StockStatus {
  return stockStatuses.includes(value as StockStatus) ? (value as StockStatus) : "in_stock";
}

function inferQuantity(product: Product) {
  if (Number.isFinite(product.quantity_available)) return product.quantity_available;
  const noteCount = product.stock_note?.match(/\d+/)?.[0];
  if (noteCount) return Number(noteCount);
  if (product.stock_status === "sold_out") return 0;
  if (product.stock_status === "limited") return 6;
  return 12;
}

export function normalizeProduct(product: Partial<Product>): Product {
  const normalized: Product = {
    id: text(product.id, safeUuid()),
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
    images: textArray(product.images),
    image_variants: Array.isArray(product.image_variants) ? product.image_variants.filter((item): item is { thumbnail: string; detail: string } => Boolean(item && typeof item.thumbnail === "string" && typeof item.detail === "string")) : [],
    image_paths: textArray(product.image_paths),
    featured: booleanValue(product.featured),
    sort_order: numberValue(product.sort_order),
    active: booleanValue(product.active, true),
  };

  const quantity = inferQuantity(normalized);
  return {
    ...normalized,
    quantity_available: quantity,
    stock_status: quantity === 0 ? "sold_out" : quantity <= LIMITED_STOCK_THRESHOLD ? "limited" : "in_stock",
  };
}

function normalizePayment(payment: unknown): PaymentSettings {
  return {
    ...defaultPayment,
    ...paymentSettingsSchema.parse(payment),
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
    throw new Error("Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
  }

  return supabase;
}

export async function getCatalogCoreData(): Promise<Pick<CatalogData, "products" | "booth">> {
  const [products, booth] = await Promise.all([getPublicProducts(), getPublicBoothSettings()]);
  return { products, booth };
}

export async function getPublicProducts(): Promise<Product[]> {
  const client = requireSupabase();
  const { data, error } = await client.from("products").select(PRODUCT_COLUMNS).eq("active", true).order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => normalizeProduct(productRowSchema.parse(row)));
}

export async function getPublicBoothSettings(): Promise<BoothSettings> {
  const client = requireSupabase();
  const { data, error } = await client.from("booth_settings").select(BOOTH_COLUMNS).limit(1).maybeSingle();
  if (error) throw error;
  return normalizeBooth(data ?? defaultBooth);
}

export async function getPublicPaymentSettings(): Promise<PaymentSettings> {
  const client = requireSupabase();
  const { data, error } = await client.from("payment_settings").select(PAYMENT_COLUMNS).limit(1).maybeSingle();
  if (error) throw error;
  return normalizePayment(data ?? defaultPayment);
}

export async function getCatalogData(): Promise<CatalogData> {
  const [catalog, payment] = await Promise.all([getCatalogCoreData(), getPublicPaymentSettings()]);
  return { ...catalog, payment };
}

export async function getAdminProducts(): Promise<Product[]> {
  const client = requireSupabase();

  const { data, error } = await client.from("products").select(PRODUCT_COLUMNS).order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => normalizeProduct(productRowSchema.parse(row)));
}

export async function getAdminCatalogData(): Promise<CatalogData> {
  const client = requireSupabase();

  const [products, booth, payment] = await Promise.all([
    client.from("products").select(PRODUCT_COLUMNS).order("sort_order", { ascending: true }),
    client.from("booth_settings").select(BOOTH_COLUMNS).limit(1).maybeSingle(),
    client.from("payment_settings").select(PAYMENT_COLUMNS).limit(1).maybeSingle(),
  ]);

  if (products.error) throw products.error;
  if (booth.error) throw booth.error;
  if (payment.error) throw payment.error;

  return {
    products: (products.data ?? []).map((row) => normalizeProduct(productRowSchema.parse(row))),
    booth: normalizeBooth(booth.data ?? defaultBooth),
    payment: normalizePayment(payment.data ?? defaultPayment),
  };
}

export async function saveProduct(product: Product): Promise<Product> {
  const client = requireSupabase();
  const { data: previous } = await client.from("products").select("image_paths").eq("id", product.id).maybeSingle();
  const { data, error } = await client.from("products").upsert(product).select(PRODUCT_COLUMNS).single();
  if (error) throw error;
  const removedPaths = textArray(previous?.image_paths).filter((path) => !textArray(product.image_paths).includes(path));
  if (removedPaths.length) await removeUnreferencedProductImages(client, removedPaths);
  return normalizeProduct(productRowSchema.parse(data));
}

async function removeUnreferencedProductImages(client: ReturnType<typeof requireSupabase>, paths: string[]) {
  const { data: references, error: referenceError } = await client.from("products").select("image_paths").overlaps("image_paths", paths);
  if (referenceError) throw referenceError;
  const referenced = new Set((references ?? []).flatMap((row) => textArray(row.image_paths)));
  const removable = paths.filter((path) => !referenced.has(path));
  if (removable.length) {
    const { error } = await client.storage.from("product-images").remove(removable);
    if (error) throw error;
  }
}

export async function deleteProduct(id: string) {
  const client = requireSupabase();
  const { data: product, error: readError } = await client.from("products").select("id, image_paths").eq("id", id).single();
  if (readError) throw readError;
  const { error } = await client.from("products").delete().eq("id", id);
  if (error) throw error;
  const paths = textArray(product.image_paths);
  if (paths.length) await removeUnreferencedProductImages(client, paths);
}

export async function saveBoothSettings(settings: BoothSettings) {
  const client = requireSupabase();
  const { data: previous } = await client.from("booth_settings").select("logo_path, social_qr_logo_path").eq("id", "main").maybeSingle();
  const { data, error } = await client
    .from("booth_settings")
    .upsert({ id: "main", ...settings })
    .select(BOOTH_COLUMNS)
    .single();
  if (error) throw error;
  const removed = [previous?.logo_path, previous?.social_qr_logo_path].filter((path): path is string => Boolean(path) && path !== settings.logo_path && path !== settings.social_qr_logo_path);
  if (removed.length) {
    const { data: references, error: referenceError } = await client.from("booth_settings").select("logo_path, social_qr_logo_path").or(removed.flatMap((path) => [`logo_path.eq.${path}`, `social_qr_logo_path.eq.${path}`]).join(","));
    if (referenceError) throw referenceError;
    if (!references?.length) {
      const { error: removeError } = await client.storage.from("payment-qr").remove(removed);
      if (removeError) throw removeError;
    }
  }
  return normalizeBooth(data);
}

export async function savePaymentSettings(settings: PaymentSettings) {
  const client = requireSupabase();

  const { data, error } = await client
    .from("payment_settings")
    .upsert({ id: "main", ...settings })
    .select(PAYMENT_COLUMNS)
    .single();
  if (error) throw error;
  return normalizePayment(data);
}

export async function uploadImage(bucket: string, file: File): Promise<{ url: string; path: string }> {
  const client = requireSupabase();

  const extension = file.name.split(".").pop() ?? "png";
  const path = `${safeUuid()}.${extension}`;
  const { error } = await client.storage.from(bucket).upload(path, file, { upsert: false, contentType: file.type, cacheControl: "31536000" });
  if (error) throw error;

  const { data } = client.storage.from(bucket).getPublicUrl(path);
  return { url: data.publicUrl, path };
}

export async function uploadProductImages(thumbnail: File, detail: File) {
  const client = requireSupabase();
  const id = safeUuid();
  const uploadedPaths: string[] = [];
  async function upload(suffix: string, file: File) {
    const path = `${id}-${suffix}.jpg`;
    const { error } = await client.storage.from("product-images").upload(path, file, { upsert: false, contentType: file.type, cacheControl: "31536000" });
    if (error) throw error;
    uploadedPaths.push(path);
    return client.storage.from("product-images").getPublicUrl(path).data.publicUrl;
  }
  try {
    const thumbnailUrl = await upload("thumb", thumbnail);
    const detailUrl = await upload("detail", detail);
    return { thumbnail: thumbnailUrl, detail: detailUrl, paths: [...uploadedPaths] };
  } catch (error) {
    if (uploadedPaths.length) await client.storage.from("product-images").remove(uploadedPaths);
    throw error;
  }
}

export async function signInAdmin(email: string, password: string) {
  const client = requireSupabase();

  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOutAdmin() {
  const client = requireSupabase();

  const { error } = await client.auth.signOut();
  if (error) throw error;
}

export async function getStaffAccess(): Promise<StaffAccess | null> {
  const client = requireSupabase();
  const { data, error } = await client.rpc("get_staff_access");
  if (error) throw error;
  const value = Array.isArray(data) ? data[0] : data;
  if (!value || !["owner", "admin", "staff"].includes(value.role) || typeof value.active !== "boolean") return null;
  return value as StaffAccess;
}

export async function getStaffMembers(): Promise<StaffAccess[]> {
  const client = requireSupabase();
  const { data, error } = await client.from("staff_members").select("user_id, role, active, created_at, updated_at").order("created_at");
  if (error) throw error;
  return (data ?? []) as StaffAccess[];
}

export async function saveStaffMember(member: { user_id: string; role: StaffRole; active: boolean }) {
  const client = requireSupabase();
  const { data, error } = await client.rpc("save_staff_member", { p_user_id: member.user_id, p_role: member.role, p_active: member.active });
  if (error) throw error;
  return data as StaffAccess;
}

export async function deleteStaffMember(userId: string) {
  const client = requireSupabase();
  const { error } = await client.rpc("delete_staff_member", { p_user_id: userId });
  if (error) throw error;
}

export async function createOrder(customerName: string | null, cart: CartItem[], clientRequestId: string, recoveryToken: string): Promise<Order> {
  const client = requireSupabase();
  const { data, error } = await client.rpc("create_order", {
    p_customer_name: customerName?.trim() || null,
    p_items: cart.map((item) => ({ product_id: item.product.id, quantity: item.quantity })),
    p_client_request_id: clientRequestId,
    p_recovery_token: recoveryToken,
  });
  if (error) throw error;
  const createdOrder = Array.isArray(data) ? data[0] : data;
  if (!createdOrder) throw new Error("The order was created but no order details were returned.");
  void client.functions.invoke("notify-new-order", {
    body: { orderId: createdOrder.id, recoveryToken },
  }).catch(() => undefined);
  return orderSchema.parse(createdOrder) as Order;
}

export async function getCustomerOrder(orderId: string, recoveryToken: string): Promise<Order | null> {
  const client = requireSupabase();
  const { data, error } = await client.rpc("get_customer_order", {
    p_order_id: orderId,
    p_recovery_token: recoveryToken,
  });
  if (error) throw error;
  const order = Array.isArray(data) ? data[0] : data;
  return order ? orderSchema.parse(order) as Order : null;
}

export type OrderFilter = OrderStatus | "all";
export type OrderStatusCounts = Record<OrderFilter, number>;

export async function getOrders({ page = 1, pageSize = 12, status = "all" }: { page?: number; pageSize?: number; status?: OrderFilter } = {}): Promise<{ orders: Order[]; total: number }> {
  const client = requireSupabase();
  const from = Math.max(0, page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = client
    .from("orders")
    .select(`id,order_code,customer_name,total_amount,status,created_at,updated_at,expires_at,confirmed_at,cancelled_at,expired_at,order_items(id,order_id,product_id,quantity,unit_price,product:products(${PRODUCT_COLUMNS}))`, { count: "exact" });

  if (status !== "all") query = query.eq("status", status);

  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(from, to);

  if (error) throw error;
  const orders = (data ?? []).map((row) => ({ ...orderSchema.parse(row), order_items: (row.order_items ?? []).map((item) => ({ ...item, product: Array.isArray(item.product) ? normalizeProduct(productRowSchema.parse(item.product[0])) : item.product ? normalizeProduct(productRowSchema.parse(item.product)) : undefined })) })) as Order[];
  return { orders, total: count ?? 0 };
}

export async function getOrderStatusCounts(): Promise<OrderStatusCounts> {
  const client = requireSupabase();
  const statuses: OrderStatus[] = ["pending", "confirmed", "cancelled", "expired"];
  const counts = await Promise.all(statuses.map(async (status) => {
    const { count, error } = await client.from("orders").select("id", { count: "exact", head: true }).eq("status", status);
    if (error) throw error;
    return [status, count ?? 0] as const;
  }));
  const result = Object.fromEntries(counts) as Record<OrderStatus, number>;
  return { ...result, all: statuses.reduce((sum, status) => sum + result[status], 0) };
}

export async function confirmOrderPayment(orderId: string): Promise<OrderMutationResult> {
  const client = requireSupabase();

  const { data, error } = await client.rpc("confirm_order_payment", { target_order_id: orderId });
  if (error) throw error;
  return orderMutationSchema.parse(data) as unknown as OrderMutationResult;
}

export async function cancelOrder(orderId: string): Promise<OrderMutationResult> {
  const client = requireSupabase();

  const { data, error } = await client.rpc("cancel_order", { target_order_id: orderId });
  if (error) throw error;
  return orderMutationSchema.parse(data) as unknown as OrderMutationResult;
}
export async function cancelCustomerOrder(orderId: string, recoveryToken: string): Promise<OrderMutationResult> {
  const client = requireSupabase();
  const { data, error } = await client.rpc("cancel_customer_order", { p_order_id: orderId, p_recovery_token: recoveryToken });
  if (error) throw error;
  return orderMutationSchema.parse(data) as unknown as OrderMutationResult;
}
