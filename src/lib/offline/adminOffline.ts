import type { Order, ShopMembership } from "../../types/catalog";

const ACCESS_KEY = "matsuri-admin-access-v1";
const ORDERS_KEY = "matsuri-admin-orders-v1";
const MAX_ACCESS_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_ORDER_SNAPSHOT = 200;

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
  orders: Order[];
  savedAt: string;
};

export function saveAdminAccessSnapshot(
  userId: string,
  email: string | undefined,
  memberships: ShopMembership[],
) {
  localStorage.setItem(
    ACCESS_KEY,
    JSON.stringify({ version: 1, userId, email, memberships, savedAt: new Date().toISOString() }),
  );
}

export function loadAdminAccessSnapshot(userId: string): CachedAccess | null {
  try {
    const value = JSON.parse(localStorage.getItem(ACCESS_KEY) || "null") as CachedAccess | null;
    if (
      value?.version !== 1 ||
      value.userId !== userId ||
      !Array.isArray(value.memberships) ||
      Date.now() - new Date(value.savedAt).getTime() > MAX_ACCESS_AGE_MS
    ) return null;
    return value;
  } catch {
    return null;
  }
}

export function clearAdminAccessSnapshot() {
  localStorage.removeItem(ACCESS_KEY);
}

export function saveAdminOrdersSnapshot(shopId: string, orders: Order[]) {
  const previous = loadAdminOrdersSnapshot(shopId);
  const merged = new Map(previous.map((order) => [order.id, order]));
  orders.forEach((order) => merged.set(order.id, order));
  localStorage.setItem(
    `${ORDERS_KEY}:${shopId}`,
    JSON.stringify({
      version: 1,
      shopId,
      orders: [...merged.values()]
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .slice(0, MAX_ORDER_SNAPSHOT),
      savedAt: new Date().toISOString(),
    } satisfies CachedOrders),
  );
}

export function loadAdminOrdersSnapshot(shopId: string): Order[] {
  try {
    const value = JSON.parse(
      localStorage.getItem(`${ORDERS_KEY}:${shopId}`) || "null",
    ) as CachedOrders | null;
    return value?.version === 1 && value.shopId === shopId && Array.isArray(value.orders)
      ? value.orders
      : [];
  } catch {
    return [];
  }
}
