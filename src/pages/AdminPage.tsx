import { useEffect, useMemo, useRef, useState } from "react";
import "../styles/admin.css";
import { Link } from "react-router-dom";
import { ArrowLeft, Bell, BellOff, ClipboardList, LayoutTemplate, LogOut, Package, Settings2, ShoppingBag } from "lucide-react";
import {
  deleteProduct,
  getAdminProducts,
  getCatalogData,
  getOrderStatusCounts,
  getOrders,
  saveBoothSettings,
  savePaymentSettings,
  saveProduct,
  signInAdmin,
  signOutAdmin,
} from "../lib/api";
import type { OrderFilter, OrderStatusCounts } from "../lib/api";
import { defaultPayment } from "../lib/constants";
import { getErrorMessage, isSessionNoise } from "../lib/errors";
import { subscribeToCatalogChanges } from "../lib/realtime";
import { applyPageTheme, getStoredBoothTheme, getThemeStyle } from "../lib/theme";
import { isSupabaseConfigured, safeUuid, supabase } from "../lib/supabase";
import type { BoothSettings, PaymentSettings, Product, Order } from "../types/catalog";
import { LoginPanel } from "../components/admin/LoginPanel";
import { ProductForm } from "../components/admin/ProductForm";
import { ProductList } from "../components/admin/ProductList";
import { QrManager } from "../components/admin/QrManager";
import { SettingsForm } from "../components/admin/SettingsForm";
import { OrderQueue } from "../components/admin/OrderQueue";
import { StorefrontDesigner } from "../components/admin/StorefrontDesigner";
import { Alert } from "../components/ui/Alert";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import { EmptyState } from "../components/ui/EmptyState";
import { useToast } from "../components/ui/ToastProvider";
import { canUsePush, disableOrderNotifications, enableOrderNotifications, getPushEnabled } from "../lib/pwa";
import { useTabIndicator } from "../hooks/useTabIndicator";


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
    stock_status: "in_stock",
    stock_note: "In stock",
    images: [""],
    featured: false,
    sort_order: nextSort,
    active: true,
  };
}

const orderPageSize = 12;
const emptyOrderCounts: OrderStatusCounts = { all: 0, pending: 0, confirmed: 0, cancelled: 0 };

export function AdminPage() {
  const [isAuthed, setIsAuthed] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(isSupabaseConfigured);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderFilter, setOrderFilter] = useState<OrderFilter>("pending");
  const [orderPage, setOrderPage] = useState(1);
  const [orderTotal, setOrderTotal] = useState(0);
  const [orderCounts, setOrderCounts] = useState<OrderStatusCounts>(emptyOrderCounts);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product>();
  const [viewTab, setViewTab] = useState<"orders" | "products" | "design" | "settings">("orders");
  const [activeTab, setActiveTab] = useState<"list" | "form">("list");
  const [isSignOutOpen, setIsSignOutOpen] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [booth, setBooth] = useState<BoothSettings>(() => getStoredBoothTheme());
  const [payment, setPayment] = useState<PaymentSettings>(defaultPayment);
  const toast = useToast();

  const orderRequestRef = useRef(0);
  const { containerRef: desktopNavRef, registerItem: registerDesktopTab } = useTabIndicator<string, HTMLDivElement>(viewTab, [products.length, orderCounts.pending]);
  const { containerRef: mobileTabsRef, registerItem: registerMobileTab } = useTabIndicator<string, HTMLDivElement>(activeTab, [products.length, viewTab]);


  const nextSort = useMemo(() => Math.max(0, ...products.map((product) => product.sort_order)) + 1, [products]);
  const lowStockCount = useMemo(
    () => products.filter((product) => product.active && product.stock_status !== "in_stock").length,
    [products],
  );
  const hiddenCount = useMemo(() => products.filter((product) => !product.active).length, [products]);
  useEffect(() => {
    if (!supabase) {
      setIsCheckingAuth(false);
      return undefined;
    }

    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setIsAuthed(Boolean(data.session));
      setIsCheckingAuth(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthed(Boolean(session));
      setIsCheckingAuth(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function reloadCatalogAdmin() {
    const [catalog, adminProducts] = await Promise.all([
      getCatalogData(),
      getAdminProducts(),
    ]);
    setBooth(catalog.booth);
    setPayment(catalog.payment);
    setProducts(adminProducts);
    setSelectedProduct((current) => {
      if (!current) return undefined;
      return adminProducts.find((p) => p.id === current.id);
    });
  }

  async function reloadOrders() {
    const requestId = ++orderRequestRef.current;
    setOrdersLoading(true);
    try {
      const [result, counts] = await Promise.all([
        getOrders({ page: orderPage, pageSize: orderPageSize, status: orderFilter }),
        getOrderStatusCounts(),
      ]);
      if (requestId !== orderRequestRef.current) return;
      const lastPage = Math.max(1, Math.ceil(result.total / orderPageSize));
      if (orderPage > lastPage) {
        setOrderPage(lastPage);
        return;
      }
      setOrders(result.orders);
      setOrderTotal(result.total);
      setOrderCounts(counts);
    } finally {
      if (requestId === orderRequestRef.current) setOrdersLoading(false);
    }
  }

  useEffect(() => {
    if (!isAuthed) return;
    reloadCatalogAdmin().catch((error) => {
      if (isSessionNoise(error)) return;
      toast.error(getErrorMessage(error, "Could not load admin data."), "Admin data unavailable");
    });
  }, [isAuthed]);

  useEffect(() => {
    if (!isAuthed) return;
    reloadOrders().catch((error) => {
      if (isSessionNoise(error)) return;
      toast.error(getErrorMessage(error, "Could not load orders."), "Orders unavailable");
    });
  }, [isAuthed, orderFilter, orderPage]);

  // Real-time catalog subscription
  useEffect(() => {
    if (!isAuthed) return undefined;

    let reloadTimer: number | undefined;
    const unsubscribe = subscribeToCatalogChanges({
      onChange: () => {
        window.clearTimeout(reloadTimer);
        reloadTimer = window.setTimeout(() => {
          reloadCatalogAdmin().catch((error) => {
            if (isSessionNoise(error)) return;
            toast.error(getErrorMessage(error, "Could not refresh admin data."), "Refresh failed");
          });
        }, 150);
      },
      onStatus: () => undefined,
    });

    return () => {
      window.clearTimeout(reloadTimer);
      unsubscribe();
    };
  }, [isAuthed]);

  // Real-time orders subscription
  useEffect(() => {
    if (!isAuthed || !supabase) return undefined;

    const client = supabase;
    const channel = client
      .channel("admin-orders-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => {
          reloadOrders().catch(console.error);
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "order_items" },
        () => {
          reloadOrders().catch(console.error);
        }
      )
      .subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  }, [isAuthed, orderFilter, orderPage]);

  useEffect(() => {
    applyPageTheme(booth);
  }, [booth]);

  useEffect(() => {
    if (isAuthed) void getPushEnabled().then(setPushEnabled).catch(() => setPushEnabled(false));
  }, [isAuthed]);

  async function togglePushNotifications() {
    setPushBusy(true);
    try {
      if (pushEnabled) await disableOrderNotifications();
      else await enableOrderNotifications();
      setPushEnabled(!pushEnabled);
      toast.success(pushEnabled ? "Order notifications disabled." : "Order notifications enabled on this device.");
    } catch (error) {
      toast.error(getErrorMessage(error, "Could not update notifications."), "Notifications unavailable");
    } finally {
      setPushBusy(false);
    }
  }

  useEffect(() => {
    const matchWorkspaceToScreen = () => {
      if (window.innerWidth <= 760) setViewTab((current) => current === "design" ? "settings" : current);
      else setViewTab((current) => current === "settings" ? "design" : current);
    };
    matchWorkspaceToScreen();
    window.addEventListener("resize", matchWorkspaceToScreen);
    return () => window.removeEventListener("resize", matchWorkspaceToScreen);
  }, []);

  async function runAdminAction(action: () => Promise<void>, message: string) {
    await action();
    toast.success(message);
  }

  async function handleLogin(email: string, password: string) {
    await signInAdmin(email, password);
    setIsAuthed(true);
  }

  async function handleSaveProduct(product: Product) {
    await runAdminAction(async () => {
      const wasNewProduct = !products.some((current) => current.id === product.id);
      await saveProduct(product);
      await reloadCatalogAdmin();
      setSelectedProduct(wasNewProduct ? createBlankProduct(product.sort_order + 1) : product);
    }, "Item saved.");
  }

  async function handleDeleteProduct(id: string) {
    await runAdminAction(async () => {
      await deleteProduct(id);
      setSelectedProduct(undefined);
      await reloadCatalogAdmin();
    }, "Item deleted.");
  }

  async function handleSignOut() {
    await signOutAdmin();
    setIsSignOutOpen(false);
    setIsAuthed(false);
  }

  if (isCheckingAuth) {
    return (
      <main className="admin-shell" style={getThemeStyle(booth)}>
        <Alert>Checking admin session...</Alert>
      </main>
    );
  }

  if (!isAuthed) return <LoginPanel onLogin={handleLogin} booth={booth} />;

  return (
    <main className="admin-shell" style={getThemeStyle(booth)}>
      <header className="admin-header">
        <div className="admin-header-pill">
          <div className="admin-header-brand">
            <Link to="/" aria-label="Back to catalog" className="admin-header-icon-button"><ArrowLeft size={19} /></Link>
            <span className="admin-header-mark" style={booth.logo_url ? { background: "transparent", overflow: "hidden" } : undefined}>
              {booth.logo_url ? (
                <img src={booth.logo_url} alt={booth.booth_name} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              ) : (
                <ShoppingBag size={18} />
              )}
            </span>
            <span><strong>{booth.booth_name || "Merch desk"}</strong><small>Admin workspace</small></span>
          </div>

          <div className="admin-nav-tabs" ref={desktopNavRef}>
          <button
            type="button"
            ref={registerDesktopTab("design")}
            className={`admin-nav-tab admin-nav-storefront ${viewTab === "design" ? "active" : ""}`}
            onClick={() => setViewTab("design")}
          >
            <LayoutTemplate size={15} /> Storefront
          </button>
          <button
            type="button"
            ref={registerDesktopTab("orders")}
            className={`admin-nav-tab ${viewTab === "orders" ? "active" : ""}`}
            onClick={() => setViewTab("orders")}
          >
            <ClipboardList size={15} />
            <span>Orders Queue</span>
            {orderCounts.pending > 0 && (
              <span className="admin-nav-count">
                {orderCounts.pending}
              </span>
            )}
          </button>
          <button
            type="button"
            ref={registerDesktopTab("products")}
            className={`admin-nav-tab ${viewTab === "products" ? "active" : ""}`}
            onClick={() => setViewTab("products")}
          >
            <Package size={15} />
            <span>Products ({products.length})</span>
          </button>
          <button
            type="button"
            ref={registerDesktopTab("settings")}
            className={`admin-nav-tab admin-nav-mobile-settings ${viewTab === "settings" ? "active" : ""}`}
            onClick={() => setViewTab("settings")}
          >
            <Settings2 size={15} /> Settings
          </button>
          </div>

          <div className="admin-header-actions">
            {canUsePush() && <button type="button" disabled={pushBusy} onClick={() => void togglePushNotifications()} className={`admin-notification-button ${pushEnabled ? "active" : ""}`} aria-label={pushEnabled ? "Disable order notifications" : "Enable order notifications"}>{pushEnabled ? <Bell size={16} /> : <BellOff size={16} />}<span>{pushEnabled ? "Alerts on" : "Enable alerts"}</span></button>}
            <button type="button" onClick={() => setIsSignOutOpen(true)} className="admin-signout-button"><LogOut size={16} /><span>Sign out</span></button>
          </div>
        </div>
      </header>

      <div className="admin-container">
        <section className="admin-view-hero">
          <div>
            <span>{viewTab === "orders" ? "Live operations" : viewTab === "products" ? "Catalog management" : viewTab === "settings" ? "Mobile configuration" : "Visual storefront"}</span>
            <h1>{viewTab === "orders" ? "Orders" : viewTab === "products" ? "Products" : viewTab === "settings" ? "Settings" : "Storefront designer"}</h1>
            <p>{viewTab === "orders" ? "Confirm payments and fulfil orders." : viewTab === "products" ? "Manage products, prices, and stock." : viewTab === "settings" ? "Update booth and payment details." : "Build your storefront and checkout."}</p>
          </div>
          <div className="admin-view-chips">
            {viewTab === "orders" && <><span><b>{orderCounts.pending}</b> pending</span><span><b>{orderTotal}</b> matching orders</span></>}
            {viewTab === "products" && <><span><b>{products.length}</b> total</span><span><b>{lowStockCount}</b> need attention</span><span><b>{hiddenCount}</b> hidden</span></>}
            {viewTab === "design" && <><span><b>{booth.corner_radius ?? 16}px</b> corners</span><span><b>{(booth.catalog_locale ?? "en").toUpperCase()}</b> locale</span></>}
          </div>
        </section>
        {viewTab === "orders" && (
          <OrderQueue orders={orders} filter={orderFilter} counts={orderCounts} page={orderPage} pageSize={orderPageSize} total={orderTotal} loading={ordersLoading} onFilterChange={(filter) => { setOrderFilter(filter); setOrderPage(1); }} onPageChange={setOrderPage} onOrderUpdated={() => reloadOrders().catch(console.error)} />
        )}

        {viewTab === "products" && (
          <>
            <div className="category-row admin-mobile-tabs-row" ref={mobileTabsRef} style={{ marginBottom: "16px" }}>
              <button
                type="button"
                ref={registerMobileTab("list")}
                className={`chip ${activeTab === "list" ? "chip-active" : ""}`}
                onClick={() => setActiveTab("list")}
              >
                Products List ({products.length})
              </button>
              <button
                type="button"
                ref={registerMobileTab("form")}
                className={`chip ${activeTab === "form" ? "chip-active" : ""}`}
                onClick={() => setActiveTab("form")}
              >
                Edit Product
              </button>
            </div>
            <div className="admin-grid">
              <div className={`admin-grid-col-list ${activeTab === "list" ? "show" : "hide"}`}>
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
                />
              </div>
              {selectedProduct ? (
                <div className={`admin-grid-col-form ${activeTab === "form" ? "show" : "hide"}`}>
                  <ProductForm product={selectedProduct} onSave={handleSaveProduct} onDelete={handleDeleteProduct} />
                </div>
              ) : (
                <div className={`admin-grid-col-form admin-form-empty ${activeTab === "form" ? "show" : "hide"}`}>
                  <EmptyState
                    variant="compact"
                    icon={<Package size={26} />}
                    title="No product selected"
                    message="Choose a product from the list to edit it, or start a fresh listing."
                    action={<Button icon={<Package size={16} />} onClick={() => { setSelectedProduct(createBlankProduct(nextSort)); setActiveTab("form"); }}>Create product</Button>}
                  />
                </div>
              )}
            </div>
          </>
        )}

        {viewTab === "design" && <StorefrontDesigner
          settings={booth}
          products={products}
          payment={payment}
          onSave={(settings) => runAdminAction(async () => { const saved = await saveBoothSettings(settings); setBooth(saved); }, "Storefront design published.")}
          onSavePayment={(settings) => runAdminAction(async () => { const saved = await savePaymentSettings(settings); setPayment(saved); }, "Checkout settings saved.")}
        />}
        {viewTab === "settings" && <section className="admin-mobile-settings-page"><SettingsForm settings={booth} onSave={async (settings) => { const saved = await saveBoothSettings(settings); setBooth(saved); toast.success("Booth settings saved."); }} /><QrManager settings={payment} onSave={async (settings) => { const saved = await savePaymentSettings(settings); setPayment(saved); toast.success("Checkout settings saved."); }} /></section>}
      </div>
      <Modal title="Sign out of admin?" isOpen={isSignOutOpen} onClose={() => setIsSignOutOpen(false)} className="signout-modal">
        <div className="signout-confirmation">
          <span className="signout-confirmation-icon"><LogOut size={22} /></span>
          <div><h3>Your work is saved.</h3><p>You’ll return to the staff login screen. The public catalog stays open for customers.</p></div>
          <div className="signout-confirmation-actions">
            <Button variant="secondary" onClick={() => setIsSignOutOpen(false)}>Stay signed in</Button>
            <Button onClick={() => void handleSignOut()}>Sign out</Button>
          </div>
        </div>
      </Modal>
    </main>
  );
}
