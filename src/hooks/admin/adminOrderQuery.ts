import type { OrderViewFilter } from "../../components/admin/orders/OrderQueue";

export type OrderDateFilter = "today" | "all" | string;

export function normalizeOrderDateFilter(
  value: boolean | string | undefined,
): OrderDateFilter {
  if (value === undefined || value === true || value === "today") return "today";
  if (value === false || value === "all") return "all";
  return value;
}

type AdminOrderQuery = {
  shopId: string;
  page: number;
  filter: OrderViewFilter;
  selectedEventId: string;
  todayOnly: boolean | string;
};

export function getAdminOrderQueryKey(query: AdminOrderQuery) {
  return [
    query.shopId,
    query.page,
    query.filter,
    query.selectedEventId,
    normalizeOrderDateFilter(query.todayOnly),
  ].join(":");
}

export function getAdminOrderCountScopeKey(
  shopId: string,
  todayOnly: boolean | string,
) {
  return [shopId, normalizeOrderDateFilter(todayOnly)].join(":");
}

export function getLocalOrderDateScope(
  dateFilter: boolean | string,
  now = new Date(),
): { createdAfter?: string; createdBefore?: string } {
  const normalized = normalizeOrderDateFilter(dateFilter);
  if (normalized === "all") return {};
  if (normalized === "today") {
    const { start, end } = getLocalOrderDayBounds(now);
    return {
      createdAfter: start.toISOString(),
      createdBefore: end.toISOString(),
    };
  }
  if (normalized.includes("..")) {
    const [startStr, endStr] = normalized.split("..");
    const startMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(startStr);
    const endMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(endStr);
    if (startMatch && endMatch) {
      const [, sy, sm, sd] = startMatch;
      const [, ey, em, ed] = endMatch;
      const start = new Date(Number(sy), Number(sm) - 1, Number(sd), 0, 0, 0, 0);
      const end = new Date(Number(ey), Number(em) - 1, Number(ed) + 1, 0, 0, 0, 0);
      return {
        createdAfter: start.toISOString(),
        createdBefore: end.toISOString(),
      };
    }
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalized);
  if (!match) return {};
  const [, y, m, d] = match;
  const start = new Date(Number(y), Number(m) - 1, Number(d), 0, 0, 0, 0);
  const end = new Date(Number(y), Number(m) - 1, Number(d) + 1, 0, 0, 0, 0);
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
