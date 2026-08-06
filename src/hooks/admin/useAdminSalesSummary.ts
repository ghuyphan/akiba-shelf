import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { getSalesSummary } from "../../lib/api/sales";
import { isSessionNoise } from "../../lib/errors";
import { loadAdminOrdersSnapshot } from "../../lib/offline/adminOffline";
import {
  listOfflineEventOrders,
  loadOfflineEventSession,
  offlineEventOrderAsOrder,
  OFFLINE_EVENT_UPDATED,
} from "../../lib/offline/offlineEvents";
import {
  mergeSalesSummaries,
  projectSalesSummary,
  type SalesSummaryState,
} from "../../lib/sales";
import { getLocalOrderDayBounds } from "./adminOrderQuery";

const emptySalesState: SalesSummaryState = {
  summary: null,
  status: "authoritative",
};

export function useAdminSalesSummary({
  enabled,
  ready,
  shopId,
  userId,
  todayOnly,
}: {
  enabled: boolean;
  ready: boolean;
  shopId: string;
  userId: string;
  todayOnly: boolean;
}) {
  const [sales, setSales] = useState<SalesSummaryState>(emptySalesState);
  const requestRef = useRef(0);
  const todayOnlyRef = useRef(todayOnly);

  useLayoutEffect(() => {
    requestRef.current += 1;
    setSales(emptySalesState);
  }, [shopId]);

  useEffect(() => {
    todayOnlyRef.current = todayOnly;
  }, [todayOnly]);

  const reloadSalesSummary = useCallback(async () => {
    const requestId = ++requestRef.current;
    const now = new Date();
    const range = todayOnlyRef.current
      ? getLocalOrderDayBounds(now)
      : { start: new Date(0), end: now };
    const from = range.start.toISOString();
    const to = range.end.toISOString();
    const localSession = await loadOfflineEventSession(shopId).catch(
      () => null,
    );
    const localLedgerOrders = localSession
      ? await listOfflineEventOrders(localSession.id).catch(() => [])
      : [];
    const localOrders = localSession
      ? localLedgerOrders.map((order) =>
          offlineEventOrderAsOrder(order, localSession),
        )
      : [];
    const unsyncedConfirmed = localSession
      ? localLedgerOrders
          .filter((order) => order.status === "confirmed" && !order.syncedAt)
          .map((order) => offlineEventOrderAsOrder(order, localSession))
      : [];
    const provisional = projectSalesSummary(unsyncedConfirmed, from, to);
    try {
      const authoritative = await getSalesSummary(shopId, from, to);
      if (requestId !== requestRef.current) return;
      setSales({
        summary: provisional.confirmed_order_count
          ? mergeSalesSummaries(authoritative, provisional)
          : authoritative,
        status: provisional.confirmed_order_count
          ? "provisional"
          : "authoritative",
      });
    } catch (error) {
      if (isSessionNoise(error)) return;
      const cached = [
        ...loadAdminOrdersSnapshot(userId, shopId, "online"),
        ...loadAdminOrdersSnapshot(userId, shopId, "event"),
        ...localOrders,
      ];
      const unique = [
        ...new Map(cached.map((order) => [order.id, order])).values(),
      ];
      if (requestId !== requestRef.current) return;
      setSales({
        summary: projectSalesSummary(unique, from, to),
        status: "fallback",
      });
    }
  }, [shopId, userId]);

  useEffect(() => {
    if (!enabled || !ready) return;
    const refresh = () => void reloadSalesSummary();
    refresh();
    window.addEventListener("online", refresh);
    window.addEventListener(OFFLINE_EVENT_UPDATED, refresh);
    return () => {
      window.removeEventListener("online", refresh);
      window.removeEventListener(OFFLINE_EVENT_UPDATED, refresh);
    };
  }, [enabled, ready, reloadSalesSummary, todayOnly]);

  return { reloadSalesSummary, sales };
}
