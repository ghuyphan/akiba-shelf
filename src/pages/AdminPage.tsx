import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "../styles/admin.css";
import { Navigate } from "react-router-dom";
import {
  deleteProduct,
  getAdminCatalogData,
  getShopWorkspaceSummary,
  getOrderStatusCounts,
  getOrders,
  saveBoothSettings,
  savePaymentSettings,
  savePromotionSettings,
  saveProduct,
  signInAdmin,
  signOutAdmin,
} from "../lib/api";
import type { OrderFilter, OrderStatusCounts } from "../lib/api";
import {
  defaultBooth,
  defaultPayment,
  defaultPromotion,
  MAX_OWNED_SHOPS,
} from "../lib/constants";
import { getErrorMessage, isSessionNoise } from "../lib/errors";
import { subscribeToCatalogChanges } from "../lib/realtime";
import {
  applyPageTheme,
  getStoredBoothTheme,
  getThemeStyle,
  resetPageTheme,
} from "../utils/theme";
import { getAdminBranding, useDocumentBranding } from "../lib/branding";
import type {
  BoothSettings,
  PaymentSettings,
  PromotionSettings,
  Product,
  Order,
} from "../types/catalog";
import {
  AdminAccessCheck,
  AdminAccessDenied,
  LoginPanel,
} from "../components/admin/LoginPanel";
import { useToast } from "../components/ui/ToastProvider";
import { useAdminSession } from "../hooks/useAdminSession";
import { usePlatformI18n } from "../lib/i18n/platformI18n";
import { PwaInstallBanner } from "../components/admin/PwaInstallBanner";
import { useAdminOrderRealtime } from "../hooks/useAdminOrderRealtime";
import { AdminWorkspaceHeader } from "../components/admin/AdminWorkspaceHeader";
import { AdminViewHero } from "../components/admin/AdminViewHero";
import { AdminWorkspaceContent } from "../components/admin/AdminWorkspaceContent";
import type { AdminViewTab } from "../components/admin/adminWorkspaceTypes";
import { SignOutDialog } from "../components/ui/SignOutDialog";

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

export function AdminPage() {
  const {
    state: adminSession,
    refresh: refreshAdminSession,
    selectShop,
  } = useAdminSession();
  const isAuthed = adminSession.status === "authorized";
  const shopId = isAuthed ? adminSession.access.shop_id : "";
  const canManageCatalog = isAuthed && adminSession.access.role !== "staff";
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderFilter, setOrderFilter] = useState<OrderFilter>("pending");
  const [ordersTodayOnly, setOrdersTodayOnly] = useState(true);
  const [orderPage, setOrderPage] = useState(1);
  const [orderTotal, setOrderTotal] = useState(0);
  const [orderCounts, setOrderCounts] =
    useState<OrderStatusCounts>(emptyOrderCounts);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [workspaceLoadFailed, setWorkspaceLoadFailed] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product>();
  const [viewTab, setViewTab] = useState<AdminViewTab>("orders");
  const [isSignOutOpen, setIsSignOutOpen] = useState(false);
  const [signOutBusy, setSignOutBusy] = useState(false);
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

  const orderRequestRef = useRef(0);
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
  const hiddenCount = useMemo(
    () => products.filter((product) => !product.active).length,
    [products],
  );
  useEffect(() => {
    catalogRequestRef.current += 1;
    orderRequestRef.current += 1;
    setProducts([]);
    setOrders([]);
    setOrderCounts(emptyOrderCounts);
    setOrderTotal(0);
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
  useEffect(() => {
    orderPageRef.current = orderPage;
    orderFilterRef.current = orderFilter;
    ordersTodayOnlyRef.current = ordersTodayOnly;
  }, [orderPage, orderFilter, ordersTodayOnly]);

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
        loadedCatalogShopRef.current = shopId;
        setSelectedProduct((current) => {
          if (!current) return undefined;
          return catalog.products.find((p) => p.id === current.id);
        });
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
      const loadKey = [
        shopId,
        page,
        orderFilterRef.current,
        ordersTodayOnlyRef.current,
        refreshCounts,
      ].join(":");
      if (orderLoadRef.current?.key === loadKey)
        return orderLoadRef.current.promise;
      const requestId = ++orderRequestRef.current;
      setOrdersLoading(true);
      const promise = (async () => {
        // "Today" follows the staff's local day, recomputed on every fetch so an
        // open admin session rolls over correctly at midnight.
        let createdAfter: string | undefined;
        let createdBefore: string | undefined;
        if (ordersTodayOnlyRef.current) {
          const startOfToday = new Date();
          startOfToday.setHours(0, 0, 0, 0);
          const startOfTomorrow = new Date(startOfToday);
          startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);
          createdAfter = startOfToday.toISOString();
          createdBefore = startOfTomorrow.toISOString();
        }
        const [result, counts] = await Promise.all([
          getOrders(shopId, {
            page,
            pageSize: orderPageSize,
            status: orderFilterRef.current,
            createdAfter,
            createdBefore,
          }),
          refreshCounts
            ? getOrderStatusCounts(shopId, { createdAfter, createdBefore })
            : Promise.resolve(null),
        ]);
        if (requestId !== orderRequestRef.current) return;
        const lastPage = Math.max(1, Math.ceil(result.total / orderPageSize));
        if (page > lastPage) {
          setOrderPage(lastPage);
          return;
        }
        setOrders(result.orders);
        setOrderTotal(result.total);
        loadedOrderQueryRef.current = [
          shopId,
          page,
          orderFilterRef.current,
          ordersTodayOnlyRef.current,
        ].join(":");
        if (counts) {
          setOrderCounts(counts);
          loadedOrderCountScopeRef.current = [
            shopId,
            ordersTodayOnlyRef.current,
          ].join(":");
        }
      })().finally(() => {
        if (requestId === orderRequestRef.current) setOrdersLoading(false);
        if (orderLoadRef.current?.promise === promise)
          orderLoadRef.current = null;
      });
      orderLoadRef.current = { key: loadKey, promise };
      return promise;
    },
    [shopId],
  );

  const scheduleOrdersReload = useAdminOrderRealtime({
    enabled: isAuthed,
    shopId,
    onRefresh: () => reloadOrders(true),
    onError: (error) => {
      if (isSessionNoise(error)) return;
      toast.error(
        tRef.current(getErrorMessage(error, "Could not refresh orders.")),
        tRef.current("Refresh failed"),
      );
    },
  });

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
  }, [canManageCatalog, isInitialLoading, reloadCatalogAdmin, shopId, t, toast]);

  useEffect(() => {
    if (!isAuthed) return;
    if (isInitialLoading) return;
    const queryKey = [shopId, orderPage, orderFilter, ordersTodayOnly].join(":");
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
    const countScope = [shopId, ordersTodayOnly].join(":");
    if (loadedOrderCountScopeRef.current === countScope) return;

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const startOfTomorrow = new Date(startOfToday);
    startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);

    getOrderStatusCounts(
      shopId,
      ordersTodayOnly
        ? {
            createdAfter: startOfToday.toISOString(),
            createdBefore: startOfTomorrow.toISOString(),
          }
        : {},
    )
      .then((counts) => {
        setOrderCounts(counts);
        loadedOrderCountScopeRef.current = countScope;
      })
      .catch((error) => {
        if (isSessionNoise(error)) return;
        toast.error(
          t("Could not load the admin workspace."),
          t("Admin unavailable"),
        );
      });
  }, [isAuthed, shopId, ordersTodayOnly, isInitialLoading, t, toast]);

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
    applyPageTheme(booth, `id:${shopId}`);
    return () => resetPageTheme();
  }, [booth, isAuthed, shopId]);

  useEffect(() => {
    if (isAuthed && !canManageCatalog && viewTab !== "orders")
      setViewTab("orders");
  }, [isAuthed, canManageCatalog, viewTab]);
  useEffect(() => {
    if (isAuthed && viewTab === "team" && adminSession.access.role !== "owner")
      setViewTab("orders");
  }, [isAuthed, adminSession, viewTab]);

  useEffect(() => {
    const matchWorkspaceToScreen = () => {
      if (!canManageCatalog) {
        setViewTab("orders");
        return;
      }
      if (window.innerWidth <= 760)
        setViewTab((current) => (current === "design" ? "settings" : current));
      else
        setViewTab((current) => (current === "settings" ? "design" : current));
    };
    matchWorkspaceToScreen();
    window.addEventListener("resize", matchWorkspaceToScreen);
    return () => window.removeEventListener("resize", matchWorkspaceToScreen);
  }, [canManageCatalog]);

  async function runAdminAction(action: () => Promise<void>, message: string) {
    await action();
    toast.success(t(message));
  }

  async function handleLogin(email: string, password: string) {
    await signInAdmin(email, password);
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
    await runAdminAction(async () => {
      markLocalWrite();
      await deleteProduct(shopId, id);
      markLocalWrite();
      setSelectedProduct(undefined);
      await reloadCatalogAdmin();
    }, "Item deleted.");
  }

  async function handleSignOut() {
    setSignOutBusy(true);
    try {
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
    (adminSession.status === "authorized" && isInitialLoading)
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

  const canCreateShop =
    adminSession.memberships.filter((membership) => membership.role === "owner")
      .length < MAX_OWNED_SHOPS;
  return (
    <main className="admin-shell" style={getThemeStyle(booth)}>
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
        <AdminViewHero
          viewTab={viewTab}
          booth={booth}
          productsCount={products.length}
          lowStockCount={lowStockCount}
          hiddenCount={hiddenCount}
          pendingOrderCount={orderCounts.pending}
          matchingOrderCount={orderTotal}
        />
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
          ordersTodayOnly={ordersTodayOnly}
          orderCounts={orderCounts}
          orderPage={orderPage}
          orderPageSize={orderPageSize}
          orderTotal={orderTotal}
          ordersLoading={ordersLoading}
          onRetry={() => {
            setWorkspaceLoadFailed(false);
            setIsInitialLoading(true);
          }}
          onOrderFilterChange={(filter) => {
            setOrderFilter(filter);
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
  );
}
