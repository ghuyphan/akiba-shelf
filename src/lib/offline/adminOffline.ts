import type { Order, ShopMembership } from "../../types/catalog";
import { z } from "zod";
import { cachedAdminOrderSchema, shopMembershipSchema } from "../schemas";

const ACCESS_KEY = "matsuri-admin-access-v1";
const ORDERS_KEY = "matsuri-admin-orders-v1";
const MAX_ACCESS_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_ORDER_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_ORDER_SNAPSHOT = 200;
export type AdminOrderSource = "online" | "event" | `event:${string}`;

type CachedAccess = {
  version: 1;
  userId: string;
  email?: string;
  memberships: ShopMembership[];
  savedAt: string;
};

type CachedOrders = {
  version: 1;
  shopId: string;
  source?: AdminOrderSource;
  orders: Order[];
  savedAt: string;
};

export function saveAdminAccessSnapshot(
  userId: string,
  email: string | undefined,
  memberships: ShopMembership[],
) {
  localStorage.setItem(
    `${ACCESS_KEY}:${userId}`,
    JSON.stringify({
      version: 1,
      userId,
      email,
      memberships,
      savedAt: new Date().toISOString(),
    }),
  );
}

export function loadAdminAccessSnapshot(userId: string): CachedAccess | null {
  const key = `${ACCESS_KEY}:${userId}`;
  try {
    const value = JSON.parse(localStorage.getItem(key) || "null") as unknown;
    const parsed = zCachedAccess.safeParse(value);
    if (
      !parsed.success ||
      parsed.data.userId !== userId ||
      Date.now() - new Date(parsed.data.savedAt).getTime() > MAX_ACCESS_AGE_MS
    ) {
      localStorage.removeItem(key);
      return null;
    }
    return parsed.data;
  } catch {
    localStorage.removeItem(key);
    return null;
  }
}

export function clearAdminAccessSnapshot(userId?: string) {
  if (userId) localStorage.removeItem(`${ACCESS_KEY}:${userId}`);
  localStorage.removeItem(ACCESS_KEY);
}

export function clearAdminOfflineData(userId: string) {
  clearAdminAccessSnapshot(userId);
  const prefix = `${ORDERS_KEY}:${userId}:`;
  for (let index = localStorage.length - 1; index >= 0; index -= 1) {
    const key = localStorage.key(index);
    if (!key?.startsWith(`${ORDERS_KEY}:`)) continue;
    const isLegacyUnscopedKey = key.split(":").length <= 3;
    if (key.startsWith(prefix) || isLegacyUnscopedKey)
      localStorage.removeItem(key);
  }
}

export function saveAdminOrdersSnapshot(
  userId: string,
  shopId: string,
  orders: Order[],
  source: AdminOrderSource = "online",
) {
  const previous = loadAdminOrdersSnapshot(userId, shopId, source);
  const merged = new Map(previous.map((order) => [order.id, order]));
  orders.forEach((order) => merged.set(order.id, order));
  localStorage.setItem(
    `${ORDERS_KEY}:${userId}:${shopId}:${source}`,
    JSON.stringify({
      version: 1,
      shopId,
      source,
      orders: [...merged.values()]
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .slice(0, MAX_ORDER_SNAPSHOT),
      savedAt: new Date().toISOString(),
    } satisfies CachedOrders),
  );
}

export function loadAdminOrdersSnapshot(
  userId: string,
  shopId: string,
  source: AdminOrderSource = "online",
): Order[] {
  const key = `${ORDERS_KEY}:${userId}:${shopId}:${source}`;
  try {
    const value = JSON.parse(localStorage.getItem(key) || "null") as unknown;
    const parsed = zCachedOrders.safeParse(value);
    const isValid =
      parsed.success &&
      parsed.data.shopId === shopId &&
      (parsed.data.source === source ||
        (source === "online" && !parsed.data.source)) &&
      Date.now() - new Date(parsed.data.savedAt).getTime() <= MAX_ORDER_AGE_MS;
    if (!isValid) {
      localStorage.removeItem(key);
      return [];
    }
    return parsed.data.orders as unknown as Order[];
  } catch {
    localStorage.removeItem(key);
    return [];
  }
}

const zCachedAccess = z.object({
  version: z.literal(1),
  userId: z.string().min(1),
  email: z.string().optional(),
  memberships: z.array(shopMembershipSchema),
  savedAt: z.string().datetime(),
});

const zCachedOrders = z.object({
  version: z.literal(1),
  shopId: z.string().min(1),
  source: z
    .union([
      z.literal("online"),
      z.literal("event"),
      z.string().startsWith("event:"),
    ])
    .optional(),
  orders: z.array(cachedAdminOrderSchema),
  savedAt: z.string().datetime(),
});
