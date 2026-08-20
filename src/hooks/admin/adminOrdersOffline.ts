import type { OrderViewFilter } from "../../components/admin/orders/OrderQueue";
import type { OrderStatusCounts } from "../../lib/api/orders";
import { loadAdminOrdersSnapshot } from "../../lib/offline/adminOffline";
import {
  listOfflineEventOrders,
  loadOfflineEventSession,
  offlineEventOrderAsOrder,
} from "../../lib/offline/offlineEvents";
import type { Order } from "../../types/catalog";
import {
  getLocalOrderDayBounds,
  normalizeOrderDateFilter,
} from "./adminOrderQuery";

export const emptyAdminOrderCounts: OrderStatusCounts = {
  all: 0,
  pending: 0,
  confirmed: 0,
  cancelled: 0,
  expired: 0,
};

function isInDateScope(
  order: Order,
  todayOnly: boolean | string,
  start: Date,
  end: Date,
) {
  const normalized = normalizeOrderDateFilter(todayOnly);
  if (normalized === "all") return true;
  if (normalized === "today") {
    const created = new Date(order.created_at);
    return created >= start && created < end;
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalized);
  if (!match) return true;
  const [, y, m, d] = match;
  const customStart = new Date(
    Number(y),
    Number(m) - 1,
    Number(d),
    0,
    0,
    0,
    0,
  );
  const customEnd = new Date(
    Number(y),
    Number(m) - 1,
    Number(d) + 1,
    0,
    0,
    0,
    0,
  );
  const created = new Date(order.created_at);
  return created >= customStart && created < customEnd;
}

function countOrders(orders: Order[], todayOnly: boolean | string) {
  const { start, end } = getLocalOrderDayBounds();
  return orders.reduce<OrderStatusCounts>(
    (counts, order) => {
      if (!isInDateScope(order, todayOnly, start, end)) return counts;
      counts[order.status] += 1;
      counts.all += 1;
      return counts;
    },
    { ...emptyAdminOrderCounts },
  );
}

async function loadLocalEventOrders(shopId: string) {
  const session = await loadOfflineEventSession(shopId).catch(() => null);
  if (!session) return [];
  const orders = await listOfflineEventOrders(session.id).catch(() => []);
  return orders.map((order) => offlineEventOrderAsOrder(order, session));
}

async function mergeCachedEventOrders(
  userId: string,
  shopId: string,
  selectedEventId = "",
) {
  const cached = loadAdminOrdersSnapshot(userId, shopId, "event");
  const merged = new Map(cached.map((order) => [order.id, order]));
  if (selectedEventId) {
    for (const order of loadAdminOrdersSnapshot(
      userId,
      shopId,
      `event:${selectedEventId}`,
    ))
      merged.set(order.id, order);
  }
  for (const order of await loadLocalEventOrders(shopId))
    merged.set(order.id, order);
  return [...merged.values()].sort((left, right) =>
    right.created_at.localeCompare(left.created_at),
  );
}

export async function loadOfflineAdminOrderPage({
  userId,
  shopId,
  filter,
  selectedEventId,
  todayOnly,
  page,
  pageSize,
}: {
  userId: string;
  shopId: string;
  filter: OrderViewFilter;
  selectedEventId: string;
  todayOnly: boolean | string;
  page: number;
  pageSize: number;
}) {
  let available =
    filter === "event"
      ? await mergeCachedEventOrders(userId, shopId, selectedEventId)
      : loadAdminOrdersSnapshot(userId, shopId, "online");
  if (filter === "event" && selectedEventId)
    available = available.filter(
      (order) => order.offline_event_session_id === selectedEventId,
    );

  const { start, end } = getLocalOrderDayBounds();
  const scoped = available.filter((order) => {
    if (filter !== "event" && filter !== "all" && order.status !== filter)
      return false;
    return isInDateScope(order, todayOnly, start, end);
  });
  const from = Math.max(0, page - 1) * pageSize;
  return {
    orders: scoped.slice(from, from + pageSize),
    total: scoped.length,
    hasCachedOnlineOrders: filter === "event" || available.length > 0,
  };
}

export async function loadOfflineAdminOrderCounts({
  userId,
  shopId,
  todayOnly,
}: {
  userId: string;
  shopId: string;
  todayOnly: boolean | string;
}) {
  const online = loadAdminOrdersSnapshot(userId, shopId, "online");
  const events = await mergeCachedEventOrders(userId, shopId);
  const { start, end } = getLocalOrderDayBounds();
  return {
    counts: countOrders(online, todayOnly),
    eventCount: events.filter((order) =>
      isInDateScope(order, todayOnly, start, end),
    ).length,
  };
}
