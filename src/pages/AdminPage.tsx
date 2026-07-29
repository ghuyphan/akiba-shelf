import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "../styles/admin/admin.css";
import { Navigate, useNavigate } from "react-router";
import { getAdminCatalogData } from "../lib/api/catalog";
import {
  getOrderStatusCounts,
  getOrderNotificationStatus,
  getOrders,
  retryOrderNotification,
  type OrderStatusCounts,
} from "../lib/api/orders";
import { deleteProduct, saveProduct } from "../lib/api/products";
import {
  saveBoothSettings,
  savePaymentSettings,
  savePromotionSettings,
} from "../lib/api/settings";
import { signInAdmin, signOutAdmin } from "../lib/api/auth";
import { getShopWorkspaceSummary } from "../lib/api/shops";
import { getOfflineEventOrders } from "../lib/api/offlineEvents";
import { getSalesSummary } from "../lib/api/sales";
import {
  defaultBooth,
  defaultPayment,
  defaultPromotion,
  MAX_OWNED_SHOPS,
} from "../lib/constants";
import {
  getErrorMessage,
  isSessionNoise,
  isTransportError,
} from "../lib/errors";
import { subscribeToCatalogChanges } from "../lib/realtime";
import {
  applyAdminPageTheme,
  getAdminThemeStyle,
  resetPageTheme,
} from "../utils/theme";
import { getStoredBoothTheme } from "../utils/themeStorage";
import { getAdminBranding, useDocumentBranding } from "../lib/branding";
import type {
  BoothSettings,
  PaymentSettings,
  PromotionSettings,
  Product,
  Order,
  OrderNotificationStatus,
} from "../types/catalog";
import {
  AdminAccessCheck,
  AdminAccessDenied,
  LoginPanel,
} from "../components/admin/auth/LoginPanel";
import { useToast } from "../components/ui/ToastProvider";
import { useAdminSession } from "../hooks/admin/useAdminSession";
import { usePlatformI18n } from "../lib/i18n/platformI18n";
import { PwaInstallBanner } from "../components/admin/shell/PwaInstallBanner";
import { getOfflineEventSignOutRisk } from "../lib/offline/offlineEvents";
import { useAdminOrderRealtime } from "../hooks/admin/useAdminOrderRealtime";
import { AdminWorkspaceHeader } from "../components/admin/shell/AdminWorkspaceHeader";
import { AdminViewHero } from "../components/admin/shell/AdminViewHero";
import { AdminAttentionPanel } from "../components/admin/shell/AdminAttentionPanel";
import { AdminWorkspaceContent } from "../components/admin/shell/AdminWorkspaceContent";
import { AdminUnsavedChangesProvider } from "../components/admin/shell/AdminUnsavedChanges";
import type { OrderViewFilter } from "../components/admin/orders/OrderQueue";
import { SignOutDialog } from "../components/ui/SignOutDialog";
import { EventPinDialog } from "../components/ui/EventPinDialog";
import {
  loadAdminOrdersSnapshot,
  saveAdminOrdersSnapshot,
} from "../lib/offline/adminOffline";
import {
  loadCatalogSnapshot,
  saveCatalogSnapshot,
} from "../lib/offline/offline";
import {
  listOfflineEventOrders,
  loadOfflineEventSession,
  offlineEventOrderAsOrder,
  OFFLINE_EVENT_UPDATED,
} from "../lib/offline/offlineEvents";
import { reportError } from "../lib/observability";
import { useMediaQuery } from "../hooks/shared/useMediaQuery";
import { useAdminViewRoute } from "../hooks/admin/useAdminViewRoute";
import {
  mergeSalesSummaries,
  projectSalesSummary,
  type SalesSummaryState,
} from "../lib/sales";
import {
  getEventAdminUnlockExpiresAt,
  hasEventDevicePin,
  OFFLINE_EVENT_ACCESS_UPDATED,
  verifyEventDevicePin,
} from "../lib/offline/eventAccess";
import {
  getAdminOrderCountScopeKey,
  getAdminOrderQueryKey,
  getLocalOrderDateScope,
  getLocalOrderDayBounds,
} from "../hooks/admin/adminOrderQuery";

const orderPageSize = 12;
// Realtime events caused by this tab's own writes are ignored inside this
// window; the local reload/state update already reflects them.
const localWriteQuietMs = 2000;
const emptyOrderCounts: OrderStatusCounts = {
  all: 0,
  pending: 0,
  confirmed: 0,
  cancelled: 0,
  expired: 0,
};
const emptySalesState: SalesSummaryState = {
  summary: null,
  status: "authoritative",
};
type EventAccessState =
  | { status: "checking" | "unlocked" }
  | { status: "locked"; eventName: string };

export function AdminPage() {
  const navigate = useNavigate();
  const {
    state: adminSession,
    refresh: refreshAdminSession,
    selectShop,
  } = useAdminSession();
  const isAuthed = adminSession.status === "authorized";
  const shopId = isAuthed ? adminSession.access.shop_id : "";
  const userId = isAuthed ? adminSession.userId : "";
  const canManageCatalog = isAuthed && adminSession.access.role !== "staff";
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderFilter, setOrderFilter] = useState<OrderViewFilter>("pending");
  const [selectedEventId, setSelectedEventId] = useState("");
  const [eventOrderCount, setEventOrderCount] = useState(0);
  const [ordersTodayOnly, setOrdersTodayOnly] = useState(true);
  const [orderPage, setOrderPage] = useState(1);
  const [orderTotal, setOrderTotal] = useState(0);
  const [orderCounts, setOrderCounts] =
    useState<OrderStatusCounts>(emptyOrderCounts);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [sales, setSales] = useState<SalesSummaryState>(emptySalesState);
  const [notificationStatuses, setNotificationStatuses] = useState<
    OrderNotificationStatus[]
  >([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [workspaceLoadFailed, setWorkspaceLoadFailed] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product>();
  const { viewTab, setViewTab } = useAdminViewRoute();
  const [isSignOutOpen, setIsSignOutOpen] = useState(false);
  const [signOutBusy, setSignOutBusy] = useState(false);
  const [eventAccess, setEventAccess] = useState<EventAccessState>({
    status: "checking",
  });
  const [booth, setBooth] = useState<BoothSettings>(() => {
    const activeShopId = localStorage.getItem("akiba-active-shop")?.trim();
    return activeShopId
      ? getStoredBoothTheme(`id:${activeShopId}`)
      : defaultBooth;
  });
  const [payment, setPayment] = useState<PaymentSettings>(defaultPayment);
  const [promotion, setPromotion] =
    useState<PromotionSettings>(defaultPromotion);
  const toast = useToast();
  const { t } = usePlatformI18n();
  const compactAdminLayout = useMediaQuery("(max-width: 1100px)");

  const verifiedBranding =
    isAuthed && booth.shop_id === shopId && !isInitialLoading && !catalogLoading
      ? getAdminBranding(
          adminSession.access.shop_name,
          booth.booth_name,
          booth.logo_url,
          booth.theme_background,
        )
      : null;
  useDocumentBranding(verifiedBranding);

  useEffect(() => {
    if (!isAuthed || !shopId) {
      setEventAccess({ status: "unlocked" });
      return;
    }
    let active = true;
    let refreshRequest = 0;
    let expiryTimer: number | undefined;
    const clearExpiryTimer = () => {
      if (expiryTimer !== undefined) window.clearTimeout(expiryTimer);
      expiryTimer = undefined;
    };
    const refresh = (showChecking = false) => {
      const requestId = ++refreshRequest;
      clearExpiryTimer();
      if (showChecking) setEventAccess({ status: "checking" });
      void loadOfflineEventSession(shopId)
        .then((session) => {
          if (!active || requestId !== refreshRequest) return;
          const pinConfigured = hasEventDevicePin(shopId);
          const unlockExpiresAt = pinConfigured
            ? getEventAdminUnlockExpiresAt(shopId)
            : null;
          const protectedSession = Boolean(
            session && session.status !== "closed" && pinConfigured,
          );
          const requiresPin = protectedSession && unlockExpiresAt === null;
          setEventAccess(
            requiresPin
              ? { status: "locked", eventName: session?.name ?? "" }
              : { status: "unlocked" },
          );
          if (protectedSession && unlockExpiresAt !== null) {
            expiryTimer = window.setTimeout(
              () => refresh(),
              Math.max(0, unlockExpiresAt - Date.now() + 25),
            );
          }
        })
        .catch(() => {
          if (!active || requestId !== refreshRequest) return;
          setEventAccess({ status: "unlocked" });
        });
    };
    const handleUpdate = (event: Event) => {
      const detail = (event as CustomEvent<{ shopId?: string }>).detail;
      if (!detail?.shopId || detail.shopId === shopId) refresh();
    };
    refresh(true);
    window.addEventListener(OFFLINE_EVENT_UPDATED, handleUpdate);
    window.addEventListener(OFFLINE_EVENT_ACCESS_UPDATED, handleUpdate);
    return () => {
      active = false;
      refreshRequest += 1;
      clearExpiryTimer();
      window.removeEventListener(OFFLINE_EVENT_UPDATED, handleUpdate);
      window.removeEventListener(OFFLINE_EVENT_ACCESS_UPDATED, handleUpdate);
    };
  }, [isAuthed, shopId]);

  const orderRequestRef = useRef(0);
  const notificationRequestRef = useRef(0);
  const salesRequestRef = useRef(0);
  const catalogRequestRef = useRef(0);
  const catalogLoadRef = useRef<{
    shopId: string;
    promise: Promise<void>;
  } | null>(null);
  const orderLoadRef = useRef<{
    key: string;
    promise: Promise<void>;
  } | null>(null);
  const loadedCatalogShopRef = useRef("");
  const orderPageRef = useRef(orderPage);
  const orderFilterRef = useRef(orderFilter);
  const selectedEventIdRef = useRef(selectedEventId);
  const ordersTodayOnlyRef = useRef(ordersTodayOnly);
  const loadedOrderQueryRef = useRef("");
  const loadedOrderCountScopeRef = useRef("");
  const tRef = useRef(t);
  const lastLocalWriteRef = useRef(0);
  const lowStockCount = useMemo(
    () =>
      products.filter(
        (product) => product.active && product.stock_status !== "in_stock",
      ).length,
    [products],
  );
  const expiringOrderCount = useMemo(() => {
    const cutoff = Date.now() + 10 * 60 * 1000;
    return orders.filter((order) => {
      if (order.status !== "pending" || !order.expires_at) return false;
      const expiresAt = new Date(order.expires_at).getTime();
      return Number.isFinite(expiresAt) && expiresAt <= cutoff;
    }).length;
  }, [orders]);
  useEffect(() => {
    catalogRequestRef.current += 1;
    orderRequestRef.current += 1;
    notificationRequestRef.current += 1;
    salesRequestRef.current += 1;
    setProducts([]);
    setOrders([]);
    setOrderCounts(emptyOrderCounts);
    setNotificationStatuses([]);
    setEventOrderCount(0);
    setSelectedEventId("");
    setOrderTotal(0);
    setSales(emptySalesState);
    setSelectedProduct(undefined);
    setBooth(shopId ? getStoredBoothTheme(`id:${shopId}`) : defaultBooth);
    setPayment(defaultPayment);
    setPromotion(defaultPromotion);
    setWorkspaceLoadFailed(false);
    setIsInitialLoading(true);
    loadedOrderQueryRef.current = "";
    loadedOrderCountScopeRef.current = "";
    loadedCatalogShopRef.current = "";
    catalogLoadRef.current = null;
    orderLoadRef.current = null;
  }, [shopId]);

  const refreshNotificationStatus = useCallback(async () => {
    const requestId = ++notificationRequestRef.current;
    const statuses = await getOrderNotificationStatus(shopId);
    if (requestId === notificationRequestRef.current)
      setNotificationStatuses(statuses);
  }, [shopId]);

  useEffect(() => {
    if (!isAuthed || isInitialLoading) return;
    const refresh = () => {
      void refreshNotificationStatus().catch((error) => {
        if (!isSessionNoise(error)) {
          reportError(error, {
            stage: "admin_notification_status",
            shopId,
          });
        }
      });
    };
    refresh();
    const interval = window.setInterval(refresh, 30_000);
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    return () => {
      notificationRequestRef.current += 1;
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", refresh);
    };
  }, [isAuthed, isInitialLoading, refreshNotificationStatus, shopId]);

  const handleRetryNotification = useCallback(
    async (orderId: string) => {
      try {
        const retried = await retryOrderNotification(
          shopId,
          orderId,
          "admin_attention_panel",
        );
        await refreshNotificationStatus();
        if (retried) {
          toast.success(t("Order alert queued for another delivery attempt."));
        } else {
          toast.info(
            t(
              "This alert is no longer eligible for retry. Its status was refreshed.",
            ),
          );
        }
        return retried;
      } catch (error) {
        toast.error(
          t(getErrorMessage(error, "Could not retry this order alert.")),
          t("Retry unavailable"),
        );
        throw error;
      }
    },
    [refreshNotificationStatus, shopId, t, toast],
  );
  useEffect(() => {
    orderPageRef.current = orderPage;
    orderFilterRef.current = orderFilter;
    selectedEventIdRef.current = selectedEventId;
    ordersTodayOnlyRef.current = ordersTodayOnly;
  }, [orderPage, orderFilter, ordersTodayOnly, selectedEventId]);

  useEffect(() => {
    tRef.current = t;
  }, [t]);

  const markLocalWrite = useCallback(() => {
    lastLocalWriteRef.current = Date.now();
  }, []);

  const reloadCatalogAdmin = useCallback(() => {
    if (catalogLoadRef.current?.shopId === shopId)
      return catalogLoadRef.current.promise;
    const requestId = ++catalogRequestRef.current;
    const requestedShopId = shopId;
    setCatalogLoading(true);
    const promise = getAdminCatalogData(shopId)
      .then((catalog) => {
        if (
          requestId !== catalogRequestRef.current ||
          requestedShopId !== shopId
        )
          return;
        setBooth(catalog.booth);
        setPayment(catalog.payment);
        setPromotion(catalog.promotion);
        setProducts(catalog.products);
        saveCatalogSnapshot(catalog, shopId, {
          replaceProducts: true,
          complete: true,
        });
        loadedCatalogShopRef.current = shopId;
        setSelectedProduct((current) => {
          if (!current) return undefined;
          return catalog.products.find((p) => p.id === current.id);
        });
      })
      .catch((error) => {
        if (navigator.onLine && !isTransportError(error)) throw error;
        const snapshot = loadCatalogSnapshot(shopId);
        if (!snapshot?.complete || !snapshot.payment || !snapshot.promotion)
          throw error;
        setBooth(snapshot.booth);
        setPayment(snapshot.payment);
        setPromotion(snapshot.promotion);
        setProducts(snapshot.products);
        loadedCatalogShopRef.current = shopId;
      })
      .finally(() => {
        if (requestId === catalogRequestRef.current) setCatalogLoading(false);
        if (catalogLoadRef.current?.promise === promise)
          catalogLoadRef.current = null;
      });
    catalogLoadRef.current = { shopId, promise };
    return promise;
  }, [shopId]);

  const reloadOrders = useCallback(
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
      setOrdersLoading(true);
      const promise = (async () => {
        // "Today" follows the staff's local day, recomputed on every fetch so an
        // open admin session rolls over correctly at midnight.
        const filter = orderFilterRef.current;
        const dateScope = getLocalOrderDateScope(ordersTodayOnlyRef.current);
        const [result, countResult] =
          filter === "event"
            ? await Promise.all([
                getOfflineEventOrders(shopId, {
                  page,
                  pageSize: orderPageSize,
                  sessionId: selectedEventIdRef.current || undefined,
                  ...dateScope,
                }),
                refreshCounts
                  ? getOrderStatusCounts(shopId, dateScope)
                  : Promise.resolve(null),
              ]).then(
                ([eventResult, counts]) =>
                  [
                    eventResult,
                    counts ? ([counts, eventResult.total] as const) : null,
                  ] as const,
              )
            : await Promise.all([
                getOrders(shopId, {
                  page,
                  pageSize: orderPageSize,
                  status: filter,
                  ...dateScope,
                }),
                refreshCounts
                  ? Promise.all([
                      getOrderStatusCounts(shopId, dateScope),
                      getOfflineEventOrders(shopId, {
                        page: 1,
                        pageSize: 1,
                        ...dateScope,
                      })
                        .then((eventResult) => eventResult.total)
                        .catch(() => null),
                    ])
                  : Promise.resolve(null),
              ]);
        if (requestId !== orderRequestRef.current) return;
        const eventSource = selectedEventIdRef.current
          ? (`event:${selectedEventIdRef.current}` as const)
          : "event";
        saveAdminOrdersSnapshot(
          userId,
          shopId,
          result.orders,
          filter === "event" ? eventSource : "online",
        );
        const lastPage = Math.max(1, Math.ceil(result.total / orderPageSize));
        if (page > lastPage) {
          setOrderPage(lastPage);
          return;
        }
        setOrders(result.orders);
        setOrderTotal(result.total);
        loadedOrderQueryRef.current = queryKey;
        if (filter === "event" && !selectedEventIdRef.current)
          setEventOrderCount(result.total);
        if (countResult) {
          setOrderCounts(countResult[0]);
          if (countResult[1] !== null) setEventOrderCount(countResult[1]);
          loadedOrderCountScopeRef.current = getAdminOrderCountScopeKey(
            shopId,
            ordersTodayOnlyRef.current,
          );
        }
      })()
        .catch(async (error) => {
          if (navigator.onLine && !isTransportError(error)) throw error;
          const filter = orderFilterRef.current;
          const source =
            filter === "event"
              ? selectedEventIdRef.current
                ? (`event:${selectedEventIdRef.current}` as const)
                : "event"
              : "online";
          const cached = loadAdminOrdersSnapshot(userId, shopId, source);
          let available = cached;
          if (filter === "event") {
            const session = await loadOfflineEventSession(shopId);
            const localOrders = session
              ? (await listOfflineEventOrders(session.id)).map((order) =>
                  offlineEventOrderAsOrder(order, session),
                )
              : [];
            const merged = new Map(cached.map((order) => [order.id, order]));
            localOrders.forEach((order) => merged.set(order.id, order));
            available = [...merged.values()].sort((a, b) =>
              b.created_at.localeCompare(a.created_at),
            );
            if (selectedEventIdRef.current)
              available = available.filter(
                (order) =>
                  order.offline_event_session_id === selectedEventIdRef.current,
              );
          }
          if (!available.length && filter !== "event") throw error;
          const { start: today, end: tomorrow } = getLocalOrderDayBounds();
          const scoped = available.filter((order) => {
            if (
              filter !== "event" &&
              filter !== "all" &&
              order.status !== filter
            )
              return false;
            const created = new Date(order.created_at);
            return (
              !ordersTodayOnlyRef.current ||
              (created >= today && created < tomorrow)
            );
          });
          const from = Math.max(0, page - 1) * orderPageSize;
          setOrders(scoped.slice(from, from + orderPageSize));
          setOrderTotal(scoped.length);
          loadedOrderQueryRef.current = queryKey;
          if (filter === "event" && !selectedEventIdRef.current)
            setEventOrderCount(scoped.length);
          const onlineCached = loadAdminOrdersSnapshot(
            userId,
            shopId,
            "online",
          );
          const counts = onlineCached.reduce<OrderStatusCounts>(
            (result, order) => {
              const created = new Date(order.created_at);
              if (
                ordersTodayOnlyRef.current &&
                (created < today || created >= tomorrow)
              )
                return result;
              result[order.status] += 1;
              result.all += 1;
              return result;
            },
            { ...emptyOrderCounts },
          );
          setOrderCounts(counts);
          loadedOrderCountScopeRef.current = getAdminOrderCountScopeKey(
            shopId,
            ordersTodayOnlyRef.current,
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

  const reloadSalesSummary = useCallback(async () => {
    const requestId = ++salesRequestRef.current;
    const now = new Date();
    const range = ordersTodayOnlyRef.current
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
      if (requestId !== salesRequestRef.current) return;
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
      if (requestId !== salesRequestRef.current) return;
      setSales({
        summary: projectSalesSummary(unique, from, to),
        status: "fallback",
      });
    }
  }, [shopId, userId]);

  const scheduleOrdersReload = useAdminOrderRealtime({
    enabled: isAuthed,
    shopId,
    onRefresh: () => {
      void reloadSalesSummary();
      return reloadOrders(true);
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
    if (!isAuthed || isInitialLoading) return;
    const refresh = () => void reloadSalesSummary();
    refresh();
    window.addEventListener("online", refresh);
    window.addEventListener(OFFLINE_EVENT_UPDATED, refresh);
    return () => {
      window.removeEventListener("online", refresh);
      window.removeEventListener(OFFLINE_EVENT_UPDATED, refresh);
    };
  }, [isAuthed, isInitialLoading, ordersTodayOnly, reloadSalesSummary]);

  // Load initial workspace data in parallel before showing the admin panel
  useEffect(() => {
    if (!isAuthed) {
      setIsInitialLoading(true);
      return;
    }
    if (!isInitialLoading) return;

    let active = true;
    async function loadWorkspaceData() {
      try {
        if (canManageCatalog) {
          await Promise.all([reloadCatalogAdmin(), reloadOrders(true)]);
        } else {
          const [summary] = await Promise.all([
            getShopWorkspaceSummary(shopId),
            reloadOrders(true),
          ]);
          if (!active) return;
          setBooth({
            ...defaultBooth,
            shop_id: summary.id,
            booth_name: summary.booth_name,
            logo_url: summary.logo_url,
            theme_background: summary.theme_background,
          });
        }
        if (active) setWorkspaceLoadFailed(false);
      } catch (error) {
        if (!isSessionNoise(error)) {
          if (active) setWorkspaceLoadFailed(true);
          toast.error(
            t("Could not load workspace data."),
            t("Connection error"),
          );
        }
      } finally {
        if (active) {
          setIsInitialLoading(false);
        }
      }
    }

    void loadWorkspaceData();

    return () => {
      active = false;
    };
  }, [
    isAuthed,
    canManageCatalog,
    shopId,
    isInitialLoading,
    reloadCatalogAdmin,
    reloadOrders,
    t,
    toast,
  ]);

  useEffect(() => {
    if (!canManageCatalog || isInitialLoading) return;
    if (loadedCatalogShopRef.current === shopId) return;

    reloadCatalogAdmin().catch((error) => {
      if (isSessionNoise(error)) return;
      toast.error(
        t("Could not load the admin workspace."),
        t("Admin unavailable"),
      );
    });
  }, [
    canManageCatalog,
    isInitialLoading,
    reloadCatalogAdmin,
    shopId,
    t,
    toast,
  ]);

  useEffect(() => {
    if (!isAuthed) return;
    if (isInitialLoading) return;
    const queryKey = getAdminOrderQueryKey({
      shopId,
      page: orderPage,
      filter: orderFilter,
      selectedEventId,
      todayOnly: ordersTodayOnly,
    });
    if (loadedOrderQueryRef.current === queryKey) return;

    reloadOrders().catch((error) => {
      if (isSessionNoise(error)) return;
      toast.error(
        t("Could not load the admin workspace."),
        t("Admin unavailable"),
      );
    });
  }, [
    isAuthed,
    shopId,
    orderFilter,
    selectedEventId,
    ordersTodayOnly,
    orderPage,
    isInitialLoading,
    reloadOrders,
    t,
    toast,
  ]);

  useEffect(() => {
    if (!isAuthed) return;
    if (isInitialLoading) return;
    const countScope = getAdminOrderCountScopeKey(shopId, ordersTodayOnly);
    if (loadedOrderCountScopeRef.current === countScope) return;

    const scopeNow = new Date();
    const dateScope = getLocalOrderDateScope(ordersTodayOnly, scopeNow);
    const { start: startOfToday, end: startOfTomorrow } =
      getLocalOrderDayBounds(scopeNow);

    Promise.all([
      getOrderStatusCounts(shopId, dateScope),
      getOfflineEventOrders(shopId, {
        page: 1,
        pageSize: 1,
        ...dateScope,
      }),
    ])
      .then(([counts, eventResult]) => {
        setOrderCounts(counts);
        setEventOrderCount(eventResult.total);
        loadedOrderCountScopeRef.current = countScope;
      })
      .catch(async (error) => {
        if (isSessionNoise(error)) return;
        if (!navigator.onLine || isTransportError(error)) {
          const onlineCached = loadAdminOrdersSnapshot(
            userId,
            shopId,
            "online",
          );
          const eventCached = loadAdminOrdersSnapshot(userId, shopId, "event");
          const session = await loadOfflineEventSession(shopId);
          const localOrders = session
            ? (await listOfflineEventOrders(session.id)).map((order) =>
                offlineEventOrderAsOrder(order, session),
              )
            : [];
          const eventOrders = new Map(
            eventCached.map((order) => [order.id, order]),
          );
          localOrders.forEach((order) => eventOrders.set(order.id, order));
          const inScope = (order: Order) => {
            if (!ordersTodayOnly) return true;
            const created = new Date(order.created_at);
            return created >= startOfToday && created < startOfTomorrow;
          };
          setOrderCounts(
            onlineCached.reduce<OrderStatusCounts>(
              (counts, order) => {
                if (!inScope(order)) return counts;
                counts[order.status] += 1;
                counts.all += 1;
                return counts;
              },
              { ...emptyOrderCounts },
            ),
          );
          setEventOrderCount([...eventOrders.values()].filter(inScope).length);
          loadedOrderCountScopeRef.current = countScope;
          return;
        }
        toast.error(
          t("Could not load the admin workspace."),
          t("Admin unavailable"),
        );
      });
  }, [isAuthed, shopId, userId, ordersTodayOnly, isInitialLoading, t, toast]);

  useEffect(() => {
    if (!isAuthed || isInitialLoading || orderFilter !== "event") return;
    let timer: number | undefined;
    const refresh = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        reloadOrders(true).catch((error) => {
          if (isSessionNoise(error)) return;
          toast.error(
            tRef.current(getErrorMessage(error, "Could not refresh orders.")),
            tRef.current("Refresh failed"),
          );
        });
      }, 200);
    };
    const handleEventUpdate = (event: Event) => {
      const detail = (event as CustomEvent<{ shopId?: string }>).detail;
      if (!detail?.shopId || detail.shopId === shopId) refresh();
    };
    window.addEventListener(OFFLINE_EVENT_UPDATED, handleEventUpdate);
    window.addEventListener("online", refresh);
    window.addEventListener("focus", refresh);
    window.addEventListener("storage", refresh);
    const interval = window.setInterval(refresh, 15_000);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(interval);
      window.removeEventListener(OFFLINE_EVENT_UPDATED, handleEventUpdate);
      window.removeEventListener("online", refresh);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [isAuthed, isInitialLoading, orderFilter, reloadOrders, shopId, toast]);

  // Real-time catalog subscription
  useEffect(() => {
    if (!canManageCatalog) return undefined;

    let reloadTimer: number | undefined;
    const unsubscribe = subscribeToCatalogChanges(shopId, {
      onChange: () => {
        window.clearTimeout(reloadTimer);
        reloadTimer = window.setTimeout(() => {
          if (Date.now() - lastLocalWriteRef.current < localWriteQuietMs)
            return;
          reloadCatalogAdmin().catch((error) => {
            if (isSessionNoise(error)) return;
            toast.error(
              tRef.current(
                getErrorMessage(error, "Could not refresh admin data."),
              ),
              tRef.current("Refresh failed"),
            );
          });
        }, 150);
      },
      onStatus: () => undefined,
    });

    return () => {
      window.clearTimeout(reloadTimer);
      unsubscribe();
    };
  }, [canManageCatalog, shopId, reloadCatalogAdmin, toast]);

  useEffect(() => {
    if (!isAuthed || !shopId) return;
    applyAdminPageTheme(booth, `id:${shopId}`);
    return () => resetPageTheme();
  }, [booth, isAuthed, shopId]);

  useEffect(() => {
    if (isAuthed && !canManageCatalog && viewTab !== "orders")
      setViewTab("orders", true);
  }, [isAuthed, canManageCatalog, setViewTab, viewTab]);
  useEffect(() => {
    if (isAuthed && viewTab === "team" && adminSession.access.role !== "owner")
      setViewTab("orders", true);
  }, [isAuthed, adminSession, setViewTab, viewTab]);

  async function runAdminAction(action: () => Promise<void>, message: string) {
    await action();
    toast.success(t(message));
  }

  async function handleLogin(
    email: string,
    password: string,
    captchaToken: string,
  ) {
    await signInAdmin(email, password, captchaToken);
    await refreshAdminSession();
  }

  async function handleSaveProduct(product: Product) {
    await runAdminAction(async () => {
      markLocalWrite();
      await saveProduct(shopId, product);
      markLocalWrite();
      await reloadCatalogAdmin();
      setSelectedProduct(product);
    }, "Item saved.");
  }

  async function handleDeleteProduct(id: string) {
    markLocalWrite();
    const { imageCleanupPending } = await deleteProduct(shopId, id);
    markLocalWrite();
    setSelectedProduct(undefined);
    const nextProducts = products.filter((product) => product.id !== id);
    setProducts(nextProducts);
    saveCatalogSnapshot(
      { booth, payment, promotion, products: nextProducts },
      shopId,
      { replaceProducts: true, complete: true },
    );
    const followUpNotices: string[] = [];
    if (imageCleanupPending) {
      followUpNotices.push(
        t(
          "The item was deleted, but its unused images could not be cleaned up.",
        ),
      );
    }
    try {
      await reloadCatalogAdmin();
    } catch {
      followUpNotices.push(
        t(
          "The item was deleted, but the catalog could not be refreshed. Reload to verify the latest list.",
        ),
      );
    }
    if (followUpNotices.length) {
      toast.info(
        followUpNotices.join(" "),
        t("Item deleted with follow-up needed"),
      );
    } else {
      toast.success(t("Item deleted."));
    }
  }

  async function handleSignOut() {
    setSignOutBusy(true);
    try {
      let offlineRisk: Awaited<ReturnType<typeof getOfflineEventSignOutRisk>>;
      try {
        offlineRisk = await getOfflineEventSignOutRisk();
      } catch {
        toast.error(
          t(
            "Offline Event storage could not be checked. Keep this account signed in and retry after storage access is restored.",
          ),
          t("Sign-out safety check failed"),
        );
        return;
      }
      if (offlineRisk) {
        toast.error(
          t(
            "This device still owns event stock or unsynced orders. Sync and close Offline Event Mode before signing out.",
          ),
          t("Offline Event Mode is still active"),
        );
        return;
      }
      await signOutAdmin();
      setIsSignOutOpen(false);
      await refreshAdminSession();
    } catch {
      toast.error(
        t("Check your connection and try again."),
        t("Could not sign out"),
      );
    } finally {
      setSignOutBusy(false);
    }
  }

  if (
    adminSession.status === "checking" ||
    (adminSession.status === "authorized" &&
      (isInitialLoading || eventAccess.status === "checking"))
  ) {
    return <AdminAccessCheck />;
  }

  if (adminSession.status === "unauthenticated")
    return <LoginPanel onLogin={handleLogin} booth={booth} />;
  if (adminSession.status === "unauthorized") {
    return <Navigate to="/dashboard" replace />;
  }
  if (adminSession.status === "inactive") {
    return <AdminAccessDenied kind="inactive" onSignOut={handleSignOut} />;
  }
  if (adminSession.status === "error") {
    return (
      <AdminAccessDenied
        kind="error"
        message={adminSession.message}
        onRetry={refreshAdminSession}
        onSignOut={handleSignOut}
      />
    );
  }

  if (eventAccess.status === "locked") {
    return (
      <main
        className="event-admin-lock-screen"
        style={getAdminThemeStyle(booth)}
      >
        <div className="event-admin-lock-brand" aria-hidden="true">
          <span>M</span>
          <strong>Matsuri</strong>
        </div>
        <EventPinDialog
          isOpen
          mode="verify"
          copy={{
            title: t("Staff access locked"),
            message: t('Enter the local tablet PIN to manage "{{event}}".', {
              event: eventAccess.eventName,
            }),
            pinLabel: t("6-digit tablet PIN"),
            confirmPinLabel: t("Confirm tablet PIN"),
            cancelLabel: t("Back to storefront"),
            submitLabel: t("Open event console"),
            submittingLabel: t("Checking…"),
            invalidPin: t("Enter exactly 6 digits."),
            pinMismatch: t("The PINs do not match."),
            submitError: t("Could not check the tablet PIN on this device."),
            closeLabel: t("Back to storefront"),
          }}
          onClose={() =>
            navigate(
              `/s/${encodeURIComponent(adminSession.access.shop_slug)}`,
              { replace: true },
            )
          }
          onSubmit={async (pin) => {
            const result = await verifyEventDevicePin(shopId, pin);
            if (!result.ok)
              return result.blockedUntil
                ? t("Too many attempts. Wait 30 seconds and try again.")
                : t("Incorrect tablet PIN.");
            setEventAccess({ status: "unlocked" });
          }}
        />
      </main>
    );
  }

  const canCreateShop =
    adminSession.memberships.filter((membership) => membership.role === "owner")
      .length < MAX_OWNED_SHOPS;
  return (
    <AdminUnsavedChangesProvider>
      <main className="admin-shell" style={getAdminThemeStyle(booth)}>
        <AdminWorkspaceHeader
          booth={booth}
          access={adminSession.access}
          memberships={adminSession.memberships}
          viewTab={viewTab}
          productsCount={products.length}
          pendingOrderCount={orderCounts.pending}
          canManageCatalog={canManageCatalog}
          canCreateShop={canCreateShop}
          signOutBusy={signOutBusy}
          onViewTabChange={setViewTab}
          onSelectShop={selectShop}
          onRequestSignOut={() => setIsSignOutOpen(true)}
        />

        <div className="admin-container">
          <PwaInstallBanner />
          <AdminViewHero viewTab={viewTab} />
          {viewTab === "orders" && (
            <AdminAttentionPanel
              booth={booth}
              payment={payment}
              products={products}
              expiringOrderCount={expiringOrderCount}
              lowStockCount={lowStockCount}
              notificationStatuses={notificationStatuses}
              canManageCatalog={canManageCatalog}
              canRetryNotifications={adminSession.access.role !== "staff"}
              onOpenOrders={() => {
                setOrderFilter("pending");
                setSelectedEventId("");
                setOrderPage(1);
              }}
              onOpenProducts={() => setViewTab("products")}
              onOpenSettings={() =>
                setViewTab(compactAdminLayout ? "settings" : "design")
              }
              onRetryNotification={handleRetryNotification}
            />
          )}
          <AdminWorkspaceContent
            viewTab={viewTab}
            shopId={shopId}
            shopSlug={adminSession.access.shop_slug}
            canManageCatalog={canManageCatalog}
            canManageTeam={adminSession.access.role === "owner"}
            workspaceLoadFailed={workspaceLoadFailed}
            products={products}
            selectedProduct={selectedProduct}
            catalogLoading={catalogLoading}
            booth={booth}
            payment={payment}
            promotion={promotion}
            orders={orders}
            orderFilter={orderFilter}
            selectedEventId={selectedEventId}
            eventOrderCount={eventOrderCount}
            ordersTodayOnly={ordersTodayOnly}
            orderCounts={orderCounts}
            orderPage={orderPage}
            orderPageSize={orderPageSize}
            orderTotal={orderTotal}
            ordersLoading={ordersLoading}
            sales={sales}
            onRetry={() => {
              setWorkspaceLoadFailed(false);
              setIsInitialLoading(true);
            }}
            onOrderFilterChange={(filter) => {
              setOrderFilter(filter);
              if (filter !== "event") setSelectedEventId("");
              setOrderPage(1);
            }}
            onSelectedEventChange={(eventId) => {
              setOrderFilter("event");
              setSelectedEventId(eventId);
              setOrderPage(1);
            }}
            onOrdersTodayOnlyChange={(todayOnly) => {
              setOrdersTodayOnly(todayOnly);
              setOrderPage(1);
            }}
            onOrderPageChange={setOrderPage}
            onOrderUpdated={scheduleOrdersReload}
            onSelectProduct={setSelectedProduct}
            onSaveProduct={handleSaveProduct}
            onDeleteProduct={handleDeleteProduct}
            onSavePromotion={async (nextPromotion) => {
              markLocalWrite();
              const saved = await savePromotionSettings(shopId, nextPromotion);
              markLocalWrite();
              setPromotion(saved);
              toast.success(t("Promotion saved."));
            }}
            onSaveBooth={async (settings) => {
              markLocalWrite();
              const saved = await saveBoothSettings(shopId, settings);
              markLocalWrite();
              setBooth(saved);
              toast.success(
                t(
                  viewTab === "design"
                    ? "Storefront design published."
                    : "Booth settings saved.",
                ),
              );
            }}
            onSavePayment={async (settings) => {
              markLocalWrite();
              const saved = await savePaymentSettings(shopId, settings);
              markLocalWrite();
              setPayment(saved);
              toast.success(t("Checkout settings saved."));
            }}
          />
        </div>

        <SignOutDialog
          isOpen={isSignOutOpen}
          busy={signOutBusy}
          title={t("Sign out of admin?")}
          heading={t("Your work is saved.")}
          message={t(
            "You’ll return to the staff login screen. The public catalog stays open for customers.",
          )}
          cancelLabel={t("Stay signed in")}
          confirmLabel={t("Sign out")}
          loadingLabel={t("Signing out…")}
          onClose={() => setIsSignOutOpen(false)}
          onConfirm={() => void handleSignOut()}
        />
      </main>
    </AdminUnsavedChangesProvider>
  );
}
