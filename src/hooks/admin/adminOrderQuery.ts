import type { OrderViewFilter } from "../../components/admin/orders/OrderQueue";

type AdminOrderQuery = {
  shopId: string;
  page: number;
  filter: OrderViewFilter;
  selectedEventId: string;
  todayOnly: boolean;
};

export function getAdminOrderQueryKey(query: AdminOrderQuery) {
  return [
    query.shopId,
    query.page,
    query.filter,
    query.selectedEventId,
    query.todayOnly,
  ].join(":");
}

export function getAdminOrderCountScopeKey(shopId: string, todayOnly: boolean) {
  return [shopId, todayOnly].join(":");
}

export function getLocalOrderDateScope(
  todayOnly: boolean,
  now = new Date(),
): { createdAfter?: string; createdBefore?: string } {
  if (!todayOnly) return {};
  const { start, end } = getLocalOrderDayBounds(now);
  return {
    createdAfter: start.toISOString(),
    createdBefore: end.toISOString(),
  };
}

export function getLocalOrderDayBounds(now = new Date()) {
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const startOfTomorrow = new Date(startOfToday);
  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);
  return { start: startOfToday, end: startOfTomorrow };
}
