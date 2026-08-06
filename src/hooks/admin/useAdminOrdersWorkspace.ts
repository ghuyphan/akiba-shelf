import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { OrderViewFilter } from "../../components/admin/orders/OrderQueue";
import { useToast } from "../../components/ui/ToastProvider";
import { getOfflineEventOrders } from "../../lib/api/offlineEvents";
import {
  getOrders,
  getOrderStatusCounts,
  type OrderStatusCounts,
} from "../../lib/api/orders";
import {
  getErrorMessage,
  isSessionNoise,
  isTransportError,
} from "../../lib/errors";
import { usePlatformI18n } from "../../lib/i18n/platformI18n";
import { saveAdminOrdersSnapshot } from "../../lib/offline/adminOffline";
import type { Order } from "../../types/catalog";
import {
  getAdminOrderCountScopeKey,
  getAdminOrderQueryKey,
  getLocalOrderDateScope,
} from "./adminOrderQuery";
import {
  emptyAdminOrderCounts,
  loadOfflineAdminOrderCounts,
  loadOfflineAdminOrderPage,
} from "./adminOrdersOffline";
import { useAdminEventOrderRefresh } from "./useAdminEventOrderRefresh";
import { useAdminOrderRealtime } from "./useAdminOrderRealtime";
import { useAdminSalesSummary } from "./useAdminSalesSummary";

export const adminOrderPageSize = 12;

export function useAdminOrdersWorkspace({
  enabled,
  ready,
  shopId,
  userId,
}: {
  enabled: boolean;
  ready: boolean;
  shopId: string;
  userId: string;
}) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderFilter, setOrderFilter] = useState<OrderViewFilter>("pending");
  const [selectedEventId, setSelectedEventId] = useState("");
  const [eventOrderCount, setEventOrderCount] = useState(0);
  const [ordersTodayOnly, setOrdersTodayOnly] = useState(true);
  const [orderPage, setOrderPage] = useState(1);
  const [orderTotal, setOrderTotal] = useState(0);
  const [orderCounts, setOrderCounts] = useState<OrderStatusCounts>(
    emptyAdminOrderCounts,
  );
  const [ordersLoading, setOrdersLoading] = useState(false);
  const orderRequestRef = useRef(0);
  const orderCountRequestRef = useRef(0);
  const activeShopIdRef = useRef(shopId);
  const orderLoadRef = useRef<{
    key: string;
    promise: Promise<void>;
  } | null>(null);
  const orderPageRef = useRef(orderPage);
  const orderFilterRef = useRef(orderFilter);
  const selectedEventIdRef = useRef(selectedEventId);
  const ordersTodayOnlyRef = useRef(ordersTodayOnly);
  const loadedOrderQueryRef = useRef("");
  const loadedOrderCountScopeRef = useRef("");
  const toast = useToast();
  const { t } = usePlatformI18n();
  const tRef = useRef(t);

  const expiringOrderCount = useMemo(() => {
    const cutoff = Date.now() + 10 * 60 * 1_000;
    return orders.filter((order) => {
      if (order.status !== "pending" || !order.expires_at) return false;
      const expiresAt = new Date(order.expires_at).getTime();
      return Number.isFinite(expiresAt) && expiresAt <= cutoff;
    }).length;
  }, [orders]);

  useLayoutEffect(() => {
    activeShopIdRef.current = shopId;
    orderRequestRef.current += 1;
    orderCountRequestRef.current += 1;
    orderLoadRef.current = null;
  }, [shopId]);

  useLayoutEffect(() => {
    orderRequestRef.current += 1;
    orderLoadRef.current = null;
  }, [orderFilter, orderPage, ordersTodayOnly, selectedEventId]);

  useLayoutEffect(() => {
    orderCountRequestRef.current += 1;
  }, [ordersTodayOnly]);

  useEffect(() => {
    setOrders([]);
    setOrderCounts(emptyAdminOrderCounts);
    setEventOrderCount(0);
    setSelectedEventId("");
    setOrderTotal(0);
    setOrdersLoading(false);
    loadedOrderQueryRef.current = "";
    loadedOrderCountScopeRef.current = "";
  }, [shopId]);

  useEffect(() => {
    orderPageRef.current = orderPage;
    orderFilterRef.current = orderFilter;
    selectedEventIdRef.current = selectedEventId;
    ordersTodayOnlyRef.current = ordersTodayOnly;
  }, [orderPage, orderFilter, ordersTodayOnly, selectedEventId]);

  useEffect(() => {
    tRef.current = t;
  }, [t]);

  const { reloadSalesSummary, sales } = useAdminSalesSummary({
    enabled,
    ready,
    shopId,
    userId,
    todayOnly: ordersTodayOnly,
  });

  const reload = useCallback(
    async (refreshCounts = false) => {
      const page = orderPageRef.current;
      const queryKey = getAdminOrderQueryKey({
        shopId,
        page,
        filter: orderFilterRef.current,
        selectedEventId: selectedEventIdRef.current,
        todayOnly: ordersTodayOnlyRef.current,
      });
      const loadKey = `${queryKey}:${refreshCounts}`;
      if (orderLoadRef.current?.key === loadKey)
        return orderLoadRef.current.promise;
      const requestId = ++orderRequestRef.current;
      const requestedShopId = shopId;
      const requestedUserId = userId;
      const requestedFilter = orderFilterRef.current;
      const requestedEventId = selectedEventIdRef.current;
      const requestedTodayOnly = ordersTodayOnlyRef.current;
      setOrdersLoading(true);
      const promise = (async () => {
        // Recompute the staff-local day on each request so long-lived sessions
        // roll over at midnight without a page reload.
        const dateScope = getLocalOrderDateScope(requestedTodayOnly);
        const [result, countResult] =
          requestedFilter === "event"
            ? await Promise.all([
                getOfflineEventOrders(requestedShopId, {
                  page,
                  pageSize: adminOrderPageSize,
                  sessionId: requestedEventId || undefined,
                  ...dateScope,
                }),
                refreshCounts
                  ? Promise.all([
                      getOrderStatusCounts(requestedShopId, dateScope),
                      requestedEventId
                        ? getOfflineEventOrders(requestedShopId, {
                            page: 1,
                            pageSize: 1,
                            ...dateScope,
                          }).then((eventResult) => eventResult.total)
                        : Promise.resolve(null),
                    ])
                  : Promise.resolve(null),
              ]).then(
                ([eventResult, countResult]) =>
                  [
                    eventResult,
                    countResult
                      ? ([
                          countResult[0],
                          countResult[1] ?? eventResult.total,
                        ] as const)
                      : null,
                  ] as const,
              )
            : await Promise.all([
                getOrders(requestedShopId, {
                  page,
                  pageSize: adminOrderPageSize,
                  status: requestedFilter,
                  ...dateScope,
                }),
                refreshCounts
                  ? Promise.all([
                      getOrderStatusCounts(requestedShopId, dateScope),
                      getOfflineEventOrders(requestedShopId, {
                        page: 1,
                        pageSize: 1,
                        ...dateScope,
                      })
                        .then((eventResult) => eventResult.total)
                        .catch(() => null),
                    ])
                  : Promise.resolve(null),
              ]);
        if (
          requestId !== orderRequestRef.current ||
          requestedShopId !== activeShopIdRef.current
        )
          return;
        const eventSource = requestedEventId
          ? (`event:${requestedEventId}` as const)
          : "event";
        saveAdminOrdersSnapshot(
          requestedUserId,
          requestedShopId,
          result.orders,
          requestedFilter === "event" ? eventSource : "online",
        );
        const lastPage = Math.max(
          1,
          Math.ceil(result.total / adminOrderPageSize),
        );
        if (page > lastPage) {
          setOrderPage(lastPage);
          return;
        }
        setOrders(result.orders);
        setOrderTotal(result.total);
        loadedOrderQueryRef.current = queryKey;
        if (requestedFilter === "event" && !requestedEventId)
          setEventOrderCount(result.total);
        if (countResult) {
          setOrderCounts(countResult[0]);
          if (countResult[1] !== null) setEventOrderCount(countResult[1]);
          loadedOrderCountScopeRef.current = getAdminOrderCountScopeKey(
            requestedShopId,
            requestedTodayOnly,
          );
        }
      })()
        .catch(async (error) => {
          if (
            requestId !== orderRequestRef.current ||
            requestedShopId !== activeShopIdRef.current
          )
            return;
          if (navigator.onLine && !isTransportError(error)) throw error;
          const fallback = await loadOfflineAdminOrderPage({
            userId: requestedUserId,
            shopId: requestedShopId,
            filter: requestedFilter,
            selectedEventId: requestedEventId,
            todayOnly: requestedTodayOnly,
            page,
            pageSize: adminOrderPageSize,
          });
          if (
            requestId !== orderRequestRef.current ||
            requestedShopId !== activeShopIdRef.current
          )
            return;
          if (!fallback.hasCachedOnlineOrders) throw error;
          setOrders(fallback.orders);
          setOrderTotal(fallback.total);
          loadedOrderQueryRef.current = queryKey;
          if (requestedFilter === "event" && !requestedEventId)
            setEventOrderCount(fallback.total);
          const fallbackCounts = await loadOfflineAdminOrderCounts({
            userId: requestedUserId,
            shopId: requestedShopId,
            todayOnly: requestedTodayOnly,
          });
          if (
            requestId !== orderRequestRef.current ||
            requestedShopId !== activeShopIdRef.current
          )
            return;
          setOrderCounts(fallbackCounts.counts);
          setEventOrderCount(fallbackCounts.eventCount);
          loadedOrderCountScopeRef.current = getAdminOrderCountScopeKey(
            requestedShopId,
            requestedTodayOnly,
          );
        })
        .finally(() => {
          if (requestId === orderRequestRef.current) setOrdersLoading(false);
          if (orderLoadRef.current?.promise === promise)
            orderLoadRef.current = null;
        });
      orderLoadRef.current = { key: loadKey, promise };
      return promise;
    },
    [shopId, userId],
  );

  const scheduleReload = useAdminOrderRealtime({
    enabled,
    shopId,
    onRefresh: () => {
      void reloadSalesSummary();
      return reload(true);
    },
    onError: (error) => {
      if (isSessionNoise(error)) return;
      toast.error(
        tRef.current(getErrorMessage(error, "Could not refresh orders.")),
        tRef.current("Refresh failed"),
      );
    },
  });

  useEffect(() => {
    if (!enabled || !ready) return;
    const queryKey = getAdminOrderQueryKey({
      shopId,
      page: orderPage,
      filter: orderFilter,
      selectedEventId,
      todayOnly: ordersTodayOnly,
    });
    if (loadedOrderQueryRef.current === queryKey) return;
    reload().catch((error) => {
      if (isSessionNoise(error)) return;
      toast.error(
        t("Could not load the admin workspace."),
        t("Admin unavailable"),
      );
    });
  }, [
    enabled,
    orderFilter,
    orderPage,
    ordersTodayOnly,
    ready,
    reload,
    selectedEventId,
    shopId,
    t,
    toast,
  ]);

  useEffect(() => {
    if (!enabled || !ready) return;
    const countScope = getAdminOrderCountScopeKey(shopId, ordersTodayOnly);
    if (loadedOrderCountScopeRef.current === countScope) return;
    const requestId = ++orderCountRequestRef.current;
    const requestedShopId = shopId;
    let active = true;
    const scopeNow = new Date();
    const dateScope = getLocalOrderDateScope(ordersTodayOnly, scopeNow);

    Promise.all([
      getOrderStatusCounts(requestedShopId, dateScope),
      getOfflineEventOrders(requestedShopId, {
        page: 1,
        pageSize: 1,
        ...dateScope,
      }),
    ])
      .then(([counts, eventResult]) => {
        if (
          !active ||
          requestId !== orderCountRequestRef.current ||
          requestedShopId !== activeShopIdRef.current
        )
          return;
        setOrderCounts(counts);
        setEventOrderCount(eventResult.total);
        loadedOrderCountScopeRef.current = countScope;
      })
      .catch(async (error) => {
        if (
          !active ||
          requestId !== orderCountRequestRef.current ||
          requestedShopId !== activeShopIdRef.current
        )
          return;
        if (isSessionNoise(error)) return;
        if (!navigator.onLine || isTransportError(error)) {
          const fallback = await loadOfflineAdminOrderCounts({
            userId,
            shopId: requestedShopId,
            todayOnly: ordersTodayOnly,
          });
          if (
            !active ||
            requestId !== orderCountRequestRef.current ||
            requestedShopId !== activeShopIdRef.current
          )
            return;
          setOrderCounts(fallback.counts);
          setEventOrderCount(fallback.eventCount);
          loadedOrderCountScopeRef.current = countScope;
          return;
        }
        toast.error(
          t("Could not load the admin workspace."),
          t("Admin unavailable"),
        );
      });
    return () => {
      active = false;
    };
  }, [enabled, ordersTodayOnly, ready, shopId, t, toast, userId]);

  useAdminEventOrderRefresh({
    enabled,
    ready,
    active: orderFilter === "event",
    shopId,
    reload,
    onError: (message, title) =>
      toast.error(tRef.current(message), tRef.current(title)),
  });

  const changeFilter = useCallback((filter: OrderViewFilter) => {
    setOrderFilter(filter);
    if (filter !== "event") setSelectedEventId("");
    setOrderPage(1);
  }, []);

  const selectEvent = useCallback((eventId: string) => {
    setOrderFilter("event");
    setSelectedEventId(eventId);
    setOrderPage(1);
  }, []);

  const changeTodayOnly = useCallback((todayOnly: boolean) => {
    setOrdersTodayOnly(todayOnly);
    setOrderPage(1);
  }, []);

  const openPending = useCallback(() => {
    setOrderFilter("pending");
    setSelectedEventId("");
    setOrderPage(1);
  }, []);

  return {
    changeFilter,
    changeTodayOnly,
    eventOrderCount,
    expiringOrderCount,
    openPending,
    orderCounts,
    orderFilter,
    orderPage,
    orderTotal,
    orders,
    ordersLoading,
    ordersTodayOnly,
    pageSize: adminOrderPageSize,
    reload,
    sales,
    scheduleReload,
    selectEvent,
    selectedEventId,
    setOrderPage,
  };
}
