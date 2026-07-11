import { defaultBooth, defaultPayment } from "./constants";
import { isSupabaseConfigured, safeUuid, supabase } from "./supabase";
import type { BoothSettings, CatalogData, PaymentSettings, Product, StockStatus, Order, OrderItem, OrderStatus, CartItem } from "../types/catalog";

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

function normalizeProduct(product: Partial<Product>): Product {
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
    stock_status: stockStatus(product.stock_status),
    stock_note: text(product.stock_note, "In stock"),
    images: textArray(product.images),
    featured: booleanValue(product.featured),
    sort_order: numberValue(product.sort_order),
    active: booleanValue(product.active, true),
  };

  return {
    ...normalized,
    quantity_available: inferQuantity(normalized),
  };
}

function normalizePayment(payment: PaymentSettings): PaymentSettings {
  return {
    ...defaultPayment,
    ...payment,
  };
}

function normalizeBooth(booth: BoothSettings): BoothSettings {
  return {
    ...defaultBooth,
    ...booth,
  };
}

function requireSupabase() {
  if (!supabase || !isSupabaseConfigured) {
    throw new Error("Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
  }

  return supabase;
}

export async function getCatalogData(): Promise<CatalogData> {
  const client = requireSupabase();

  const [products, booth, payment] = await Promise.all([
    client.from("products").select("*").eq("active", true).order("sort_order", { ascending: true }),
    client.from("booth_settings").select("*").limit(1).maybeSingle(),
    client.from("payment_settings").select("*").limit(1).maybeSingle(),
  ]);

  if (products.error) throw products.error;
  if (booth.error) throw booth.error;
  if (payment.error) throw payment.error;

  return {
    products: ((products.data as Product[]) ?? []).map(normalizeProduct),
    booth: normalizeBooth((booth.data as BoothSettings | null) ?? defaultBooth),
    payment: normalizePayment((payment.data as PaymentSettings | null) ?? defaultPayment),
  };
}

export async function getAdminProducts(): Promise<Product[]> {
  const client = requireSupabase();

  const { data, error } = await client.from("products").select("*").order("sort_order", { ascending: true });
  if (error) throw error;
  return ((data as Product[]) ?? []).map(normalizeProduct);
}

export async function saveProduct(product: Product): Promise<Product> {
  const client = requireSupabase();

  const { data, error } = await client.from("products").upsert(product).select().single();
  if (error) throw error;
  return data as Product;
}

export async function deleteProduct(id: string) {
  const client = requireSupabase();

  const { error } = await client.from("products").delete().eq("id", id);
  if (error) throw error;
}

export async function saveBoothSettings(settings: BoothSettings) {
  const client = requireSupabase();

  const { data, error } = await client
    .from("booth_settings")
    .upsert({ id: "main", ...settings })
    .select()
    .single();
  if (error) throw error;
  return data as BoothSettings;
}

export async function savePaymentSettings(settings: PaymentSettings) {
  const client = requireSupabase();

  const { data, error } = await client
    .from("payment_settings")
    .upsert({ id: "main", ...settings })
    .select()
    .single();
  if (error) throw error;
  return data as PaymentSettings;
}

export async function uploadImage(bucket: string, file: File) {
  const client = requireSupabase();

  const extension = file.name.split(".").pop() ?? "png";
  const path = `${safeUuid()}.${extension}`;
  const { error } = await client.storage.from(bucket).upload(path, file, { upsert: false });
  if (error) throw error;

  const { data } = client.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
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

export async function createOrder(customerName: string | null, cart: CartItem[]): Promise<Order> {
  const client = requireSupabase();
  const { data, error } = await client.rpc("create_order", {
    p_customer_name: customerName?.trim() || null,
    p_items: cart.map((item) => ({ product_id: item.product.id, quantity: item.quantity })),
  });
  if (error) throw error;
  const createdOrder = Array.isArray(data) ? data[0] : data;
  if (!createdOrder) throw new Error("The order was created but no order details were returned.");
  void client.functions.invoke("notify-new-order", { body: { orderId: createdOrder.id } }).catch(() => undefined);
  return createdOrder as Order;
}

export type OrderFilter = OrderStatus | "all";
export type OrderStatusCounts = Record<OrderFilter, number>;

export async function getOrders({ page = 1, pageSize = 12, status = "all" }: { page?: number; pageSize?: number; status?: OrderFilter } = {}): Promise<{ orders: Order[]; total: number }> {
  const client = requireSupabase();
  const from = Math.max(0, page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = client
    .from("orders")
    .select("*, order_items(*, product:products(*))", { count: "exact" });

  if (status !== "all") query = query.eq("status", status);

  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(from, to);

  if (error) throw error;
  return { orders: data as Order[], total: count ?? 0 };
}

export async function getOrderStatusCounts(): Promise<OrderStatusCounts> {
  const client = requireSupabase();
  const statuses: OrderStatus[] = ["pending", "confirmed", "cancelled"];
  const counts = await Promise.all(statuses.map(async (status) => {
    const { count, error } = await client.from("orders").select("id", { count: "exact", head: true }).eq("status", status);
    if (error) throw error;
    return [status, count ?? 0] as const;
  }));
  const result = Object.fromEntries(counts) as Record<OrderStatus, number>;
  return { ...result, all: statuses.reduce((sum, status) => sum + result[status], 0) };
}

export async function confirmOrderPayment(orderId: string): Promise<void> {
  const client = requireSupabase();

  const { error } = await client.rpc("confirm_order_payment", { target_order_id: orderId });
  if (error) throw error;
}

export async function cancelOrder(orderId: string): Promise<void> {
  const client = requireSupabase();

  const { error } = await client
    .from("orders")
    .update({ status: "cancelled" })
    .eq("id", orderId);

  if (error) throw error;
}
