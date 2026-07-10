import { useEffect, useMemo, useRef, useState } from "react";
import "../styles/admin.css";
import { Link } from "react-router-dom";
import { ArrowLeft, CreditCard, LayoutTemplate, LogOut, Package, Settings2, ShoppingBag } from "lucide-react";
import {
  deleteProduct,
  getAdminProducts,
  getCatalogData,
  getOrders,
  saveBoothSettings,
  savePaymentSettings,
  saveProduct,
  signInAdmin,
  signOutAdmin,
} from "../lib/api";
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
import { useToast } from "../components/ui/ToastProvider";

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

export function AdminPage() {
  const [isAuthed, setIsAuthed] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(isSupabaseConfigured);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product>();
  const [viewTab, setViewTab] = useState<"orders" | "products" | "design" | "settings">("orders");
  const [activeTab, setActiveTab] = useState<"list" | "form">("list");
  const [settingsTab, setSettingsTab] = useState<"booth" | "payment">("booth");
  const [isSignOutOpen, setIsSignOutOpen] = useState(false);
  const [booth, setBooth] = useState<BoothSettings>(() => getStoredBoothTheme());
  const [payment, setPayment] = useState<PaymentSettings>(defaultPayment);
  const toast = useToast();

  const activeTabRef = useRef<HTMLDivElement>(null);
  const activeTabChipRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const tabsList = ["list", "form"] as const;

  useEffect(() => {
    const row = activeTabRef.current;
    const activeIndex = tabsList.indexOf(activeTab);
    const activeChip = activeTabChipRefs.current[activeIndex];
    if (!row || !activeChip) return;
    const currentRow = row;
    const currentActiveChip = activeChip;

    function updateIndicator() {
      requestAnimationFrame(() => {
        const rowRect = currentRow.getBoundingClientRect();
        const chipRect = currentActiveChip.getBoundingClientRect();
        if (rowRect.width === 0 || chipRect.width === 0) return;
        currentRow.style.setProperty("--active-left", `${chipRect.left - rowRect.left + currentRow.scrollLeft}px`);
        currentRow.style.setProperty("--active-width", `${chipRect.width}px`);
      });
    }

    updateIndicator();
    const observer = new ResizeObserver(updateIndicator);
    observer.observe(currentRow);
    observer.observe(currentActiveChip);
    window.addEventListener("resize", updateIndicator);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateIndicator);
    };
  }, [activeTab, viewTab]);

  const nextSort = useMemo(() => Math.max(0, ...products.map((product) => product.sort_order)) + 1, [products]);
  const lowStockCount = useMemo(
    () => products.filter((product) => product.active && product.stock_status !== "in_stock").length,
    [products],
  );
  const hiddenCount = useMemo(() => products.filter((product) => !product.active).length, [products]);
  const pendingOrders = useMemo(() => orders.filter((order) => order.status === "pending"), [orders]);
  const pendingValue = useMemo(() => pendingOrders.reduce((sum, order) => sum + order.total_amount, 0), [pendingOrders]);

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

  async function reload() {
    const [catalog, adminProducts, adminOrders] = await Promise.all([
      getCatalogData(),
      getAdminProducts(),
      getOrders(),
    ]);
    setBooth(catalog.booth);
    setPayment(catalog.payment);
    setProducts(adminProducts);
    setOrders(adminOrders);
    setSelectedProduct((current) => {
      if (!current) return undefined;
      return adminProducts.find((p) => p.id === current.id);
    });
  }

  useEffect(() => {
    if (!isAuthed) return;
    reload().catch((error) => {
      if (isSessionNoise(error)) return;
      toast.error(getErrorMessage(error, "Could not load admin data."), "Admin data unavailable");
    });
  }, [isAuthed]);

  // Real-time catalog subscription
  useEffect(() => {
    if (!isAuthed) return undefined;

    let reloadTimer: number | undefined;
    const unsubscribe = subscribeToCatalogChanges({
      onChange: () => {
        window.clearTimeout(reloadTimer);
        reloadTimer = window.setTimeout(() => {
          reload().catch((error) => {
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
          reload().catch(console.error);
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "order_items" },
        () => {
          reload().catch(console.error);
        }
      )
      .subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  }, [isAuthed]);

  useEffect(() => {
    applyPageTheme(booth);
  }, [booth]);

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
      await reload();
      setSelectedProduct(wasNewProduct ? createBlankProduct(product.sort_order + 1) : product);
    }, "Item saved.");
  }

  async function handleDeleteProduct(id: string) {
    await runAdminAction(async () => {
      await deleteProduct(id);
      setSelectedProduct(undefined);
      await reload();
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

  if (!isAuthed) return <LoginPanel onLogin={handleLogin} />;

  return (
    <main className="admin-shell" style={getThemeStyle(booth)}>
      <header className="admin-header">
        <div className="admin-header-pill">
          <div className="admin-header-brand">
            <Link to="/" aria-label="Back to catalog" className="admin-header-icon-button"><ArrowLeft size={19} /></Link>
            <span className="admin-header-mark"><ShoppingBag size={18} /></span>
            <span><strong>Merch desk</strong><small>Admin workspace</small></span>
          </div>

          <div className="admin-nav-tabs">
          <button
            type="button"
            className={`admin-nav-tab ${viewTab === "design" ? "active" : ""}`}
            onClick={() => setViewTab("design")}
          >
            <LayoutTemplate size={15} /> Storefront
          </button>
          <button
            type="button"
            className={`admin-nav-tab ${viewTab === "orders" ? "active" : ""}`}
            onClick={() => setViewTab("orders")}
          >
            <span>Orders Queue</span>
            {orders.filter(o => o.status === "pending").length > 0 && (
              <span className="admin-nav-count">
                {orders.filter(o => o.status === "pending").length}
              </span>
            )}
          </button>
          <button
            type="button"
            className={`admin-nav-tab ${viewTab === "products" ? "active" : ""}`}
            onClick={() => setViewTab("products")}
          >
            Products ({products.length})
          </button>
          <button
            type="button"
            className={`admin-nav-tab ${viewTab === "settings" ? "active" : ""}`}
            onClick={() => setViewTab("settings")}
          >
            Settings
          </button>
          </div>

          <button type="button" onClick={() => setIsSignOutOpen(true)} className="admin-signout-button">
            <LogOut size={16} /><span>Sign out</span>
          </button>
        </div>
      </header>

      <div className="admin-container">
        <section className="admin-view-hero">
          <div>
            <span>{viewTab === "orders" ? "Live operations" : viewTab === "products" ? "Catalog management" : viewTab === "design" ? "Visual storefront" : "Workspace configuration"}</span>
            <h1>{viewTab === "orders" ? "Orders" : viewTab === "products" ? "Products" : viewTab === "design" ? "Storefront designer" : "Settings"}</h1>
            <p>{viewTab === "orders" ? "Confirm payments and keep fulfilment moving." : viewTab === "products" ? "Manage listings, images, pricing, and availability." : viewTab === "design" ? "Arrange the selling page and preview its visual system." : "Control what customers see and how they pay."}</p>
          </div>
          <div className="admin-view-chips">
            {viewTab === "orders" && <><span><b>{pendingOrders.length}</b> pending</span><span><b>{pendingValue.toLocaleString("vi-VN")} ₫</b> awaiting confirmation</span></>}
            {viewTab === "products" && <><span><b>{products.length}</b> total</span><span><b>{lowStockCount}</b> need attention</span><span><b>{hiddenCount}</b> hidden</span></>}
            {viewTab === "design" && <><span><b>{booth.corner_radius ?? 16}px</b> corners</span><span><b>{(booth.catalog_locale ?? "en").toUpperCase()}</b> locale</span></>}
            {viewTab === "settings" && <><span><b>{booth.booth_code || "—"}</b> booth code</span><span><b>{payment.bank_label || "—"}</b> payment label</span></>}
          </div>
        </section>
        {viewTab === "orders" && (
          <OrderQueue orders={orders} onOrderUpdated={() => reload().catch(console.error)} />
        )}

        {viewTab === "products" && (
          <>
            <div className="category-row admin-mobile-tabs-row" ref={activeTabRef} style={{ marginBottom: "16px" }}>
              <button
                type="button"
                ref={(el) => {
                  activeTabChipRefs.current[0] = el;
                }}
                className={`chip ${activeTab === "list" ? "chip-active" : ""}`}
                onClick={() => setActiveTab("list")}
              >
                Products List ({products.length})
              </button>
              <button
                type="button"
                ref={(el) => {
                  activeTabChipRefs.current[1] = el;
                }}
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
                  <div className="admin-empty-state">
                    <Package size={36} />
                    <h2>No item selected</h2>
                    <p>Select an item from the products list to edit details, or click "New Item" to create one.</p>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {viewTab === "design" && <StorefrontDesigner settings={booth} products={products} onSave={(settings) => runAdminAction(async () => { const saved = await saveBoothSettings(settings); setBooth(saved); }, "Storefront design published.")} />}

        {viewTab === "settings" && (
          <section className="admin-settings-workspace">
            <div className="admin-settings-intro">
              <div className="admin-settings-switcher" role="tablist" aria-label="Settings section">
                <button type="button" className={settingsTab === "booth" ? "active" : ""} onClick={() => setSettingsTab("booth")}><Settings2 size={17} /> Booth information</button>
                <button type="button" className={settingsTab === "payment" ? "active" : ""} onClick={() => setSettingsTab("payment")}><CreditCard size={17} /> Payment & QR</button>
              </div>
            </div>
            <div className="admin-settings-panel">
            {settingsTab === "booth" ? <SettingsForm
              settings={booth}
              onSave={(settings) =>
                runAdminAction(async () => {
                  const saved = await saveBoothSettings(settings);
                  setBooth(saved);
                }, "Booth info saved.")
              }
            /> : <QrManager
              settings={payment}
              onSave={(settings) =>
                runAdminAction(async () => {
                  const saved = await savePaymentSettings(settings);
                  setPayment(saved);
                }, "QR settings saved.")
              }
            />}
            </div>
          </section>
        )}
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
