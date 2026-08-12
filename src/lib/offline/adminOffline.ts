import type { Order, ShopMembership } from "../../types/catalog";
import { z } from "zod";
import {
  safeLocalStorageGet,
  safeLocalStorageRemove,
  safeLocalStorageSet,
} from "./safeStorage";

const ACCESS_KEY = "matsuri-admin-access-v1";
const ORDERS_KEY = "matsuri-admin-orders-v1";
const CACHE_VERSION = 2;
const MAX_ACCESS_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_ORDER_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_ORDER_SNAPSHOT = 200;
export type AdminOrderSource = "online" | "event" | `event:${string}`;
export type AdminOrderSnapshotScope = {
  status?: Order["status"];
  createdAfter?: string;
  createdBefore?: string;
};

type CachedAccess = {
  version: 2;
  userId: string;
  email?: string;
  memberships: ShopMembership[];
  savedAt: string;
};

export function saveAdminAccessSnapshot(
  userId: string,
  email: string | undefined,
  memberships: ShopMembership[],
) {
  const parsed = zCachedAccess.safeParse({
    version: CACHE_VERSION,
    userId,
    email,
    memberships,
    savedAt: new Date().toISOString(),
  });
  if (!parsed.success) return false;
  return safeLocalStorageSet(
    `${ACCESS_KEY}:${userId}`,
    JSON.stringify(parsed.data),
  );
}

export function loadAdminAccessSnapshot(userId: string): CachedAccess | null {
  const key = `${ACCESS_KEY}:${userId}`;
  try {
    const value = JSON.parse(safeLocalStorageGet(key) || "null") as unknown;
    const parsed = zCachedAccess.safeParse(value);
    if (
      !parsed.success ||
      parsed.data.userId !== userId ||
      Date.now() - new Date(parsed.data.savedAt).getTime() > MAX_ACCESS_AGE_MS
    ) {
      safeLocalStorageRemove(key);
      return null;
    }
    return parsed.data;
  } catch {
    safeLocalStorageRemove(key);
    return null;
  }
}

export function clearAdminAccessSnapshot(userId?: string) {
  if (userId) safeLocalStorageRemove(`${ACCESS_KEY}:${userId}`);
  safeLocalStorageRemove(ACCESS_KEY);
}

export function clearAdminOfflineData(userId: string) {
  clearAdminAccessSnapshot(userId);
  const prefix = `${ORDERS_KEY}:${userId}:`;
  try {
    for (let index = localStorage.length - 1; index >= 0; index -= 1) {
      const key = localStorage.key(index);
      if (!key?.startsWith(`${ORDERS_KEY}:`)) continue;
      const isLegacyUnscopedKey = key.split(":").length <= 3;
      if (key.startsWith(prefix) || isLegacyUnscopedKey)
        safeLocalStorageRemove(key);
    }
  } catch {
    // Storage cleanup is best-effort when browser storage is unavailable.
  }
}

export function saveAdminOrdersSnapshot(
  userId: string,
  shopId: string,
  orders: Order[],
  source: AdminOrderSource = "online",
  replaceScope?: AdminOrderSnapshotScope,
) {
  const previous = loadAdminOrdersSnapshot(userId, shopId, source);
  const createdAfter = replaceScope?.createdAfter
    ? new Date(replaceScope.createdAfter).getTime()
    : undefined;
  const createdBefore = replaceScope?.createdBefore
    ? new Date(replaceScope.createdBefore).getTime()
    : undefined;
  const retained = replaceScope
    ? previous.filter((order) => {
        if (replaceScope.status && order.status !== replaceScope.status)
          return true;
        const createdAt = new Date(order.created_at).getTime();
        if (createdAfter !== undefined && createdAt < createdAfter) return true;
        if (createdBefore !== undefined && createdAt >= createdBefore) return true;
        return false;
      })
    : previous;
  const merged = new Map(retained.map((order) => [order.id, order]));
  orders.forEach((order) => merged.set(order.id, order));
  const parsed = zCachedOrders.safeParse({
    version: CACHE_VERSION,
    shopId,
    source,
    orders: [...merged.values()]
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, MAX_ORDER_SNAPSHOT),
    savedAt: new Date().toISOString(),
  });
  if (!parsed.success) return false;
  return safeLocalStorageSet(
    `${ORDERS_KEY}:${userId}:${shopId}:${source}`,
    JSON.stringify(parsed.data),
  );
}

export function loadAdminOrdersSnapshot(
  userId: string,
  shopId: string,
  source: AdminOrderSource = "online",
): Order[] {
  const key = `${ORDERS_KEY}:${userId}:${shopId}:${source}`;
  try {
    const value = JSON.parse(safeLocalStorageGet(key) || "null") as unknown;
    const parsed = zCachedOrders.safeParse(value);
    const isValid =
      parsed.success &&
      parsed.data.shopId === shopId &&
      (parsed.data.source === source ||
        (source === "online" && !parsed.data.source)) &&
      Date.now() - new Date(parsed.data.savedAt).getTime() <= MAX_ORDER_AGE_MS;
    if (!isValid) {
      safeLocalStorageRemove(key);
      return [];
    }
    return parsed.data.orders as Order[];
  } catch {
    safeLocalStorageRemove(key);
    return [];
  }
}

const zCachedAccess = z.object({
  version: z.literal(CACHE_VERSION),
  userId: z.string().min(1),
  email: z.string().optional(),
  memberships: z.array(
    z.object({
      shop_id: z.string().min(1),
      shop_name: z.string(),
      shop_slug: z.string(),
      role: z.enum(["owner", "admin", "staff"]),
      active: z.boolean(),
      shop_active: z.boolean(),
    }),
  ),
  savedAt: z.string().datetime(),
});

const zCachedOrders = z.object({
  version: z.literal(CACHE_VERSION),
  shopId: z.string().min(1),
  source: z
    .union([
      z.literal("online"),
      z.literal("event"),
      z.string().startsWith("event:"),
    ])
    .optional(),
  orders: z.array(
    z.object({
      id: z.string().min(1),
      order_code: z.string().min(1),
      customer_name: z.string().nullable().optional(),
      total_amount: z.coerce.number().int().nonnegative(),
      discount_amount: z.coerce.number().int().nonnegative().optional(),
      status: z.enum(["pending", "confirmed", "cancelled", "expired"]),
      created_at: z.string(),
      updated_at: z.string(),
      expires_at: z.string().nullable(),
      confirmed_at: z.string().nullable(),
      cancelled_at: z.string().nullable(),
      expired_at: z.string().nullable(),
      fulfillment_status: z
        .enum(["unfulfilled", "preparing", "ready", "picked_up"])
        .optional(),
      fulfillment_updated_at: z.string().nullable().optional(),
      confirmed_by_email: z.string().nullable().optional(),
      cancelled_by_email: z.string().nullable().optional(),
      fulfillment_updated_by_email: z.string().nullable().optional(),
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
      offline_event_session_id: z.string().optional(),
      offline_event_name: z.string().optional(),
      order_items: z
        .array(
          z.object({
            id: z.string().min(1),
            order_id: z.string().min(1),
            product_id: z.string().min(1),
            quantity: z.coerce.number().int().positive(),
            unit_price: z.coerce.number().int().nonnegative(),
            discount_amount: z.coerce.number().int().nonnegative().optional(),
            product: z
              .object({
                id: z.string().min(1),
                name: z.string(),
                item_code: z.string(),
                images: z.array(z.string()),
              })
              .optional(),
          }),
        )
        .optional(),
    }),
  ),
  savedAt: z.string().datetime(),
});
