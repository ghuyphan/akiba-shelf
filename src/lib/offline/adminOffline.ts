import type { Order, ShopMembership } from "../../types/catalog";

const ACCESS_KEY = "matsuri-admin-access-v1";
const ORDERS_KEY = "matsuri-admin-orders-v1";
const MAX_ACCESS_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_ORDER_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_ORDER_SNAPSHOT = 200;
export type AdminOrderSource = "online" | "event";

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
    const value = JSON.parse(
      localStorage.getItem(key) || "null",
    ) as CachedAccess | null;
    if (
      value?.version !== 1 ||
      value.userId !== userId ||
      !Array.isArray(value.memberships) ||
      Date.now() - new Date(value.savedAt).getTime() > MAX_ACCESS_AGE_MS
    ) {
      localStorage.removeItem(key);
      return null;
    }
    return value;
  } catch {
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
    const value = JSON.parse(
      localStorage.getItem(key) || "null",
    ) as CachedOrders | null;
    const isValid =
      value?.version === 1 &&
      value.shopId === shopId &&
      (value.source === source || (source === "online" && !value.source)) &&
      Array.isArray(value.orders) &&
      Date.now() - new Date(value.savedAt).getTime() <= MAX_ORDER_AGE_MS;
    if (!isValid) {
      localStorage.removeItem(key);
      return [];
    }
    return value.orders;
  } catch {
    return [];
  }
}
