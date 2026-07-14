import { useEffect, useMemo, useRef, useState } from "react";
import "../styles/admin.css";
import { Link, useNavigate, Navigate } from "react-router-dom";
import {
  ArrowLeft,
  Bell,
  BellOff,
  ClipboardList,
  EllipsisVertical,
  Languages,
  LayoutTemplate,
  LogOut,
  Package,
  Settings2,
  ShoppingBag,
  Store,
  LayoutDashboard,
  Users,
} from "lucide-react";
import {
  deleteProduct,
  getAdminCatalogData,
  getShopWorkspaceSummary,
  getOrderStatusCounts,
  getOrders,
  saveBoothSettings,
  savePaymentSettings,
  saveProduct,
  signInAdmin,
  signOutAdmin,
} from "../lib/api";
import type { OrderFilter, OrderStatusCounts } from "../lib/api";
import { defaultBooth, defaultPayment } from "../lib/constants";
import { getErrorMessage, isSessionNoise } from "../lib/errors";
import { subscribeToCatalogChanges } from "../lib/realtime";
import {
  applyPageTheme,
  getStoredBoothTheme,
  getThemeStyle,
  resetPageTheme,
} from "../lib/theme";
import {
  getAdminBranding,
  safePublicUrl,
  useDocumentBranding,
} from "../lib/branding";
import { supabase } from "../lib/supabase";
import { safeUuid } from "../lib/id";
import type {
  BoothSettings,
  PaymentSettings,
  Product,
  Order,
} from "../types/catalog";
import {
  AdminAccessCheck,
  AdminAccessDenied,
  LoginPanel,
} from "../components/admin/LoginPanel";
import { AppHeader } from "../components/ui/AppHeader";
import { ProductForm } from "../components/admin/ProductForm";
import { ProductList } from "../components/admin/ProductList";
import { QrManager } from "../components/admin/QrManager";
import { SettingsForm } from "../components/admin/SettingsForm";
import { OrderQueue } from "../components/admin/OrderQueue";
import { StorefrontDesigner } from "../components/admin/StorefrontDesigner";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import { EmptyState } from "../components/ui/EmptyState";
import { useToast } from "../components/ui/ToastProvider";
import {
  canUsePush,
  disableOrderNotifications,
  enableOrderNotifications,
  getPushEnabled,
} from "../lib/pwa";
import { useTabIndicator } from "../hooks/useTabIndicator";
import { useAdminSession } from "../hooks/useAdminSession";
import { SelectMenu } from "../components/ui/SelectMenu";
import { StaffManager } from "../components/admin/StaffManager";
import { usePlatformI18n, type PlatformLocale } from "../lib/platformI18n";

function createBlankProduct(nextSort: number): Product {
  return {
    id: safeUuid(),
    name: "",
    collection: "",
    description: "",
    price_vnd: 0,
    item_code: "",
    quantity_available: 0,
    category: "Acrylic",
    badge: "",
    badge_color: "#5f8d55",
    stock_status: "in_stock",
    stock_note: "In stock",
    images: [""],
    featured: false,
    sort_order: nextSort,
    active: true,
  };
}

const orderPageSize = 12;
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
  const navigate = useNavigate();
  const isAuthed = adminSession.status === "authorized";
  const shopId = isAuthed ? adminSession.access.shop_id : "";
  const canManageCatalog = isAuthed && adminSession.access.role !== "staff";
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderFilter, setOrderFilter] = useState<OrderFilter>("pending");
  const [orderPage, setOrderPage] = useState(1);
  const [orderTotal, setOrderTotal] = useState(0);
  const [orderCounts, setOrderCounts] =
    useState<OrderStatusCounts>(emptyOrderCounts);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [workspaceLoadFailed, setWorkspaceLoadFailed] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product>();
  const [viewTab, setViewTab] = useState<
    "orders" | "products" | "design" | "settings" | "team"
  >("orders");
  const [activeTab, setActiveTab] = useState<"list" | "form">("list");
  const [isSignOutOpen, setIsSignOutOpen] = useState(false);
  const [signOutBusy, setSignOutBusy] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [overflowOpen, setOverflowOpen] = useState(false);
  const overflowRef = useRef<HTMLDivElement>(null);
  const [booth, setBooth] = useState<BoothSettings>(() => {
    const activeShopId = localStorage.getItem("akiba-active-shop")?.trim();
    return activeShopId
      ? getStoredBoothTheme(`id:${activeShopId}`)
      : defaultBooth;
  });
  const [payment, setPayment] = useState<PaymentSettings>(defaultPayment);
  const toast = useToast();
  const { t, locale, setLocale } = usePlatformI18n();
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
  const orderReloadTimerRef = useRef<number | undefined>(undefined);
  const { containerRef: desktopNavRef, registerItem: registerDesktopTab } =
    useTabIndicator<string, HTMLDivElement>(viewTab, [
      isAuthed,
      canManageCatalog,
      isInitialLoading,
      products.length,
      orderCounts.pending,
    ]);
  const { containerRef: mobileTabsRef, registerItem: registerMobileTab } =
    useTabIndicator<string, HTMLDivElement>(activeTab, [
      products.length,
      viewTab,
    ]);

  const nextSort = useMemo(
    () => Math.max(0, ...products.map((product) => product.sort_order)) + 1,
    [products],
  );
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
    setWorkspaceLoadFailed(false);
    setIsInitialLoading(true);
  }, [shopId]);
  async function reloadCatalogAdmin() {
    const requestId = ++catalogRequestRef.current;
    const requestedShopId = shopId;
    setCatalogLoading(true);
    try {
      const catalog = await getAdminCatalogData(shopId);
      if (requestId !== catalogRequestRef.current || requestedShopId !== shopId)
        return;
      setBooth(catalog.booth);
      setPayment(catalog.payment);
      setProducts(catalog.products);
      setSelectedProduct((current) => {
        if (!current) return undefined;
        return catalog.products.find((p) => p.id === current.id);
      });
    } finally {
      if (requestId === catalogRequestRef.current) setCatalogLoading(false);
    }
  }

  function scheduleOrdersReload() {
    window.clearTimeout(orderReloadTimerRef.current);
    orderReloadTimerRef.current = window.setTimeout(() => {
      reloadOrders(true).catch((error) => {
        if (isSessionNoise(error)) return;
        toast.error(
          t(getErrorMessage(error, "Could not refresh orders.")),
          t("Refresh failed"),
        );
      });
    }, 200);
  }

  async function reloadOrders(refreshCounts = false) {
    const requestId = ++orderRequestRef.current;
    setOrdersLoading(true);
    try {
      const [result, counts] = await Promise.all([
        getOrders(shopId, {
          page: orderPage,
          pageSize: orderPageSize,
          status: orderFilter,
        }),
        refreshCounts ? getOrderStatusCounts(shopId) : Promise.resolve(null),
      ]);
      if (requestId !== orderRequestRef.current) return;
      const lastPage = Math.max(1, Math.ceil(result.total / orderPageSize));
      if (orderPage > lastPage) {
        setOrderPage(lastPage);
        return;
      }
      setOrders(result.orders);
      setOrderTotal(result.total);
      if (counts) setOrderCounts(counts);
    } finally {
      if (requestId === orderRequestRef.current) setOrdersLoading(false);
    }
  }

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
          toast.error(t("Could not load workspace data."), t("Connection error"));
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthed, canManageCatalog, shopId, isInitialLoading]);

  useEffect(() => {
    if (!canManageCatalog) return;
    if (isInitialLoading) return;

    reloadCatalogAdmin().catch((error) => {
      if (isSessionNoise(error)) return;
      toast.error(t("Could not load the admin workspace."), t("Admin unavailable"));
    });
    // Reload helpers intentionally use the current pagination refs/state for this authorization transition.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManageCatalog, shopId, isInitialLoading]);

  useEffect(() => {
    if (!isAuthed) return;
    if (isInitialLoading) return;

    reloadOrders().catch((error) => {
      if (isSessionNoise(error)) return;
      toast.error(t("Could not load the admin workspace."), t("Admin unavailable"));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthed, orderFilter, orderPage, shopId, isInitialLoading]);

  useEffect(() => {
    if (!isAuthed) return;
    if (isInitialLoading) return;

    getOrderStatusCounts(shopId)
      .then(setOrderCounts)
      .catch((error) => {
        if (isSessionNoise(error)) return;
        toast.error(t("Could not load the admin workspace."), t("Admin unavailable"));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthed, shopId, isInitialLoading]);

  // Real-time catalog subscription
  useEffect(() => {
    if (!canManageCatalog) return undefined;

    let reloadTimer: number | undefined;
    const unsubscribe = subscribeToCatalogChanges(shopId, {
      onChange: () => {
        window.clearTimeout(reloadTimer);
        reloadTimer = window.setTimeout(() => {
          reloadCatalogAdmin().catch((error) => {
            if (isSessionNoise(error)) return;
            toast.error(
              t(getErrorMessage(error, "Could not refresh admin data.")),
              t("Refresh failed"),
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManageCatalog, shopId]);

  // Real-time orders subscription
  useEffect(() => {
    if (!isAuthed || !supabase) return undefined;

    const client = supabase;
    const channel = client
      .channel("admin-orders-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `shop_id=eq.${shopId}`,
        },
        scheduleOrdersReload,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "order_items",
          filter: `shop_id=eq.${shopId}`,
        },
        scheduleOrdersReload,
      )
      .subscribe();

    return () => {
      window.clearTimeout(orderReloadTimerRef.current);
      void client.removeChannel(channel);
    };
    // Re-subscribe only when the visible order window changes; the callback reads current state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthed, orderFilter, orderPage, shopId]);

  useEffect(() => {
    if (!isAuthed || !shopId) return;
    applyPageTheme(booth, `id:${shopId}`);
    return () => resetPageTheme();
  }, [booth, isAuthed, shopId]);

  useEffect(() => {
    if (isAuthed)
      void getPushEnabled(shopId)
        .then(setPushEnabled)
        .catch(() => setPushEnabled(false));
  }, [isAuthed, shopId]);

  useEffect(() => {
    if (!overflowOpen) return;
    const close = (e: MouseEvent) => {
      if (!overflowRef.current?.contains(e.target as Node))
        setOverflowOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [overflowOpen]);

  async function togglePushNotifications() {
    setPushBusy(true);
    try {
      if (pushEnabled) await disableOrderNotifications(shopId);
      else await enableOrderNotifications(shopId);
      setPushEnabled(!pushEnabled);
      toast.success(t(
        pushEnabled
          ? "Order notifications disabled."
          : "Order notifications enabled on this device.",
      ));
    } catch (error) {
      toast.error(
        t(getErrorMessage(error, "Could not update notifications.")),
        t("Notifications unavailable"),
      );
    } finally {
      setPushBusy(false);
    }
  }

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
      await saveProduct(shopId, product);
      await reloadCatalogAdmin();
      setSelectedProduct(product);
    }, "Item saved.");
  }

  async function handleDeleteProduct(id: string) {
    await runAdminAction(async () => {
      await deleteProduct(shopId, id);
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
      toast.error(t("Check your connection and try again."), t("Could not sign out"));
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
    return <Navigate to="/dashboard/shops/new" replace />;
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

  return (
    <main className="admin-shell" style={getThemeStyle(booth)}>
      <AppHeader
        brand={
          <>
            <Link
              to={`/s/${adminSession.access.shop_slug}`}
              aria-label={t("Back to catalog")}
              className="admin-header-icon-button"
            >
              <ArrowLeft size={19} />
            </Link>
            <Link
              to="/dashboard"
              aria-label={t("Go to dashboard")}
              className="admin-header-icon-button admin-dashboard-button"
            >
              <LayoutDashboard size={19} />
            </Link>
            <span
              className="admin-header-mark"
              style={
                booth.logo_url
                  ? { background: "transparent", overflow: "hidden" }
                  : undefined
              }
            >
              {safePublicUrl(booth.logo_url) ? (
                <img
                  src={safePublicUrl(booth.logo_url)}
                  alt={booth.booth_name}
                />
              ) : (
                <ShoppingBag size={18} />
              )}
            </span>
            <span className="admin-header-title">
              <strong>{booth.booth_name || t("Merch desk")}</strong>
              <small>{t("Admin workspace")}</small>
            </span>
          </>
        }
        navigation={
          <div className="admin-nav-tabs" ref={desktopNavRef}>
            {canManageCatalog && (
              <button
                type="button"
                ref={registerDesktopTab("design")}
                className={`admin-nav-tab admin-nav-storefront ${viewTab === "design" ? "active" : ""}`}
                onClick={() => setViewTab("design")}
              >
                <LayoutTemplate size={15} /> {t("Storefront")}
              </button>
            )}
            <button
              type="button"
              ref={registerDesktopTab("orders")}
              className={`admin-nav-tab admin-nav-orders ${viewTab === "orders" ? "active" : ""}`}
              onClick={() => setViewTab("orders")}
            >
              <ClipboardList size={15} />
              <span>{t("Orders Queue")}</span>
              {orderCounts.pending > 0 && (
                <span className="admin-nav-count">{orderCounts.pending}</span>
              )}
            </button>
            {canManageCatalog && (
              <button
                type="button"
                ref={registerDesktopTab("products")}
                className={`admin-nav-tab ${viewTab === "products" ? "active" : ""}`}
                onClick={() => setViewTab("products")}
              >
                <Package size={15} />
                <span>{t("Products ({{count}})", { count: products.length })}</span>
              </button>
            )}
            {isAuthed && adminSession.access.role === "owner" && (
              <button
                type="button"
                ref={registerDesktopTab("team")}
                className={`admin-nav-tab ${viewTab === "team" ? "active" : ""}`}
                onClick={() => setViewTab("team")}
              >
                <Users size={15} /> {t("Team")}
              </button>
            )}
            {canManageCatalog && (
              <button
                type="button"
                ref={registerDesktopTab("settings")}
                className={`admin-nav-tab admin-nav-mobile-settings ${viewTab === "settings" ? "active" : ""}`}
                onClick={() => setViewTab("settings")}
              >
                <Settings2 size={15} /> {t("Settings")}
              </button>
            )}
          </div>
        }
        actions={
          <>
            <SelectMenu
              className="admin-shop-switcher-menu"
              label={t("Active shop")}
              value={shopId}
              options={[
                ...adminSession.memberships.map((membership) => ({
                  value: membership.shop_id,
                  label: membership.shop_name,
                  description: `${t(membership.active && membership.shop_active ? "Active" : "Unavailable")} · ${t(membership.role)}`,
                  icon: <Store size={15} />,
                  disabled: !membership.active || !membership.shop_active,
                })),
                {
                  value: "__dashboard",
                  label: t("All shops"),
                  description: t("Open platform dashboard"),
                },
                {
                  value: "__new",
                  label: t("Create another shop"),
                  description: t("Set up a new storefront"),
                },
              ]}
              onChange={(val) => {
                if (val === "__new") {
                  navigate("/dashboard/shops/new");
                } else if (val === "__dashboard") {
                  navigate("/dashboard");
                } else {
                  selectShop(val);
                }
              }}
            />
            {/* Overflow menu: language + notification */}
            <div className="admin-overflow-menu" ref={overflowRef}>
              <button
                type="button"
                className="admin-header-button admin-overflow-toggle"
                onClick={() => setOverflowOpen((o) => !o)}
                aria-label={t("More actions")}
                title={t("More actions")}
              >
                <EllipsisVertical size={15} />
              </button>
              {overflowOpen && (
                <div className="admin-overflow-popover">
                  <div className="admin-overflow-item">
                    <Languages size={15} />
                    <span>{t("Language")}</span>
                    <div className="admin-overflow-lang-pills">
                      <button
                        type="button"
                        className={locale === "en" ? "active" : ""}
                        onClick={() => {
                          setLocale("en" as PlatformLocale);
                          setOverflowOpen(false);
                        }}
                      >
                        EN
                      </button>
                      <button
                        type="button"
                        className={locale === "vi" ? "active" : ""}
                        onClick={() => {
                          setLocale("vi" as PlatformLocale);
                          setOverflowOpen(false);
                        }}
                      >
                        VI
                      </button>
                    </div>
                  </div>
                  {canUsePush() && (
                    <button
                      type="button"
                      className="admin-overflow-item"
                      disabled={pushBusy}
                      onClick={() => {
                        void togglePushNotifications();
                        setOverflowOpen(false);
                      }}
                    >
                      {pushEnabled ? (
                        <Bell size={15} />
                      ) : (
                        <BellOff size={15} />
                      )}
                      <span>
                        {t(pushEnabled ? "Alerts on" : "Enable alerts")}
                      </span>
                    </button>
                  )}
                </div>
              )}
            </div>

            <button
              type="button"
              disabled={signOutBusy}
              onClick={() => setIsSignOutOpen(true)}
              className="admin-header-button admin-signout-button"
              aria-label={t("Sign out")}
              title={t("Sign out")}
            >
              <LogOut size={15} />
              <span>{t("Sign out")}</span>
            </button>
          </>
        }
      />

      <div className="admin-container">
        <section className="admin-view-hero">
          <div>
            <span>
              {t(viewTab === "orders"
                ? "Live operations"
                : viewTab === "products"
                  ? "Catalog management"
                  : viewTab === "settings"
                    ? "Mobile configuration"
                    : viewTab === "team"
                      ? "Access management"
                      : "Visual storefront")}
            </span>
            <h1>
              {t(viewTab === "orders"
                ? "Orders"
                : viewTab === "products"
                  ? "Products"
                  : viewTab === "settings"
                    ? "Settings"
                    : viewTab === "team"
                      ? "Team"
                      : "Storefront designer")}
            </h1>
            <p>
              {t(viewTab === "orders"
                ? "Confirm payments and fulfil orders."
                : viewTab === "products"
                  ? "Manage products, prices, and stock."
                  : viewTab === "settings"
                    ? "Update booth and payment details."
                    : viewTab === "team"
                      ? "Invite teammates and control access to this shop."
                      : "Build your storefront and checkout.")}
            </p>
          </div>
          <div className="admin-view-chips">
            {viewTab === "orders" && (
              <>
                <span>
                  <b>{orderCounts.pending}</b> {t("pending")}
                </span>
                <span>
                  <b>{orderTotal}</b> {t("matching orders")}
                </span>
              </>
            )}
            {viewTab === "products" && (
              <>
                <span>
                  <b>{products.length}</b> {t("total")}
                </span>
                <span>
                  <b>{lowStockCount}</b> {t("need attention")}
                </span>
                <span>
                  <b>{hiddenCount}</b> {t("hidden")}
                </span>
              </>
            )}
            {viewTab === "design" && (
              <>
                <span>
                  <b>{booth.corner_radius ?? 16}px</b> {t("corners")}
                </span>
                <span>
                  <b>{(booth.catalog_locale ?? "en").toUpperCase()}</b> {t("locale")}
                </span>
              </>
            )}
          </div>
        </section>
        {workspaceLoadFailed ? (
          <EmptyState
            tone="error"
            title={t("Workspace unavailable")}
            message={t("We could not load this shop's workspace. Check your connection and retry.")}
            action={
              <Button
                onClick={() => {
                  setWorkspaceLoadFailed(false);
                  setIsInitialLoading(true);
                }}
              >
                {t("Retry loading")}
              </Button>
            }
          />
        ) : (
          <>
            {viewTab === "orders" && (
              <OrderQueue
                orders={orders}
                filter={orderFilter}
                counts={orderCounts}
                page={orderPage}
                pageSize={orderPageSize}
                total={orderTotal}
                loading={ordersLoading}
                onFilterChange={(filter) => {
                  setOrderFilter(filter);
                  setOrderPage(1);
                }}
                onPageChange={setOrderPage}
                onOrderUpdated={scheduleOrdersReload}
              />
            )}

            {canManageCatalog && viewTab === "products" && (
              <>
                <div
                  className="category-row admin-mobile-tabs-row"
                  ref={mobileTabsRef}
                  style={{ marginBottom: "16px" }}
                >
                  <button
                    type="button"
                    ref={registerMobileTab("list")}
                    className={`chip ${activeTab === "list" ? "chip-active" : ""}`}
                    onClick={() => setActiveTab("list")}
                  >
                    {t("Products List ({{count}})", { count: products.length })}
                  </button>
                  <button
                    type="button"
                    ref={registerMobileTab("form")}
                    className={`chip ${activeTab === "form" ? "chip-active" : ""}`}
                    onClick={() => setActiveTab("form")}
                  >
                    {t("Edit Product")}
                  </button>
                </div>
                <div className="admin-grid">
                  <div
                    className={`admin-grid-col-list ${activeTab === "list" ? "show" : "hide"}`}
                  >
                    <ProductList
                      products={products}
                      selectedId={selectedProduct?.id}
                      onSelect={(product) => {
                        setSelectedProduct(product);
                        setActiveTab("form");
                      }}
                      onCreate={() => {
                        setSelectedProduct(createBlankProduct(nextSort));
                        setActiveTab("form");
                      }}
                      loading={catalogLoading}
                    />
                  </div>
                  {selectedProduct ? (
                    <div
                      className={`admin-grid-col-form ${activeTab === "form" ? "show" : "hide"}`}
                    >
                      <ProductForm
                        shopId={shopId}
                        product={selectedProduct}
                        onSave={handleSaveProduct}
                        onDelete={handleDeleteProduct}
                      />
                    </div>
                  ) : (
                    <div
                      className={`admin-grid-col-form admin-form-empty ${activeTab === "form" ? "show" : "hide"}`}
                    >
                      <EmptyState
                        variant="compact"
                        icon={<Package size={26} />}
                        title={t("No product selected")}
                        message={t("Choose a product from the list to edit it, or start a fresh listing.")}
                        action={
                          <Button
                            icon={<Package size={16} />}
                            onClick={() => {
                              setSelectedProduct(createBlankProduct(nextSort));
                              setActiveTab("form");
                            }}
                          >
                            {t("Create product")}
                          </Button>
                        }
                      />
                    </div>
                  )}
                </div>
              </>
            )}

            {canManageCatalog && viewTab === "design" && (
              <StorefrontDesigner
                shopId={shopId}
                settings={booth}
                products={products}
                payment={payment}
                onSave={(settings) =>
                  runAdminAction(async () => {
                    const saved = await saveBoothSettings(shopId, settings);
                    setBooth(saved);
                  }, "Storefront design published.")
                }
                onSavePayment={(settings) =>
                  runAdminAction(async () => {
                    const saved = await savePaymentSettings(shopId, settings);
                    setPayment(saved);
                  }, "Checkout settings saved.")
                }
              />
            )}
            {canManageCatalog && viewTab === "settings" && (
              <section className="admin-mobile-settings-page">
                <SettingsForm
                  shopId={shopId}
                  settings={booth}
                  onSave={async (settings) => {
                    const saved = await saveBoothSettings(shopId, settings);
                    setBooth(saved);
                    toast.success(t("Booth settings saved."));
                  }}
                />
                <QrManager
                  shopId={shopId}
                  settings={payment}
                  onSave={async (settings) => {
                    const saved = await savePaymentSettings(shopId, settings);
                    setPayment(saved);
                    toast.success(t("Checkout settings saved."));
                  }}
                />
              </section>
            )}
            {isAuthed &&
              adminSession.access.role === "owner" &&
              viewTab === "team" && (
                <section className="admin-team-page">
                  <StaffManager shopId={shopId} />
                </section>
              )}
          </>
        )}
      </div>
      <Modal
        title={t("Sign out of admin?")}
        isOpen={isSignOutOpen}
        onClose={() => {
          if (!signOutBusy) setIsSignOutOpen(false);
        }}
        className="signout-modal"
      >
        <div className="signout-confirmation">
          <span className="signout-confirmation-icon">
            <LogOut size={22} />
          </span>
          <div>
            <h3>{t("Your work is saved.")}</h3>
            <p>
              {t("You’ll return to the staff login screen. The public catalog stays open for customers.")}
            </p>
          </div>
          <div className="signout-confirmation-actions">
            <Button
              variant="secondary"
              disabled={signOutBusy}
              onClick={() => setIsSignOutOpen(false)}
            >
              {t("Stay signed in")}
            </Button>
            <Button
              loading={signOutBusy}
              loadingText={t("Signing out…")}
              onClick={() => void handleSignOut()}
            >
              {t("Sign out")}
            </Button>
          </div>
        </div>
      </Modal>
    </main>
  );
}
