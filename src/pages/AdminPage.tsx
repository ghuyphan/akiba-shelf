import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, LogOut, Package, ShoppingBag } from "lucide-react";
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
import { Alert } from "../components/ui/Alert";
import { Button } from "../components/ui/Button";

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
  const [viewTab, setViewTab] = useState<"orders" | "products" | "settings">("orders");
  const [activeTab, setActiveTab] = useState<"list" | "form">("list");
  const [booth, setBooth] = useState<BoothSettings>(() => getStoredBoothTheme());
  const [payment, setPayment] = useState<PaymentSettings>(defaultPayment);
  const [status, setStatus] = useState("");
  const [statusVariant, setStatusVariant] = useState<"info" | "success" | "error">("info");

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
      setStatusVariant("error");
      setStatus(getErrorMessage(error, "Could not load admin data."));
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
            setStatusVariant("error");
            setStatus(getErrorMessage(error, "Could not refresh admin data."));
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
    setStatusVariant("success");
    setStatus(message);
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
      <header className="admin-header" style={{ 
        display: "flex", 
        flexDirection: "column", 
        alignItems: "stretch", 
        padding: "0",
        borderBottom: "1px solid var(--line, #e2e8f0)",
        background: "var(--surface, #ffffff)"
      }}>
        {/* Top App Bar */}
        <div style={{ 
          display: "flex", 
          justifyContent: "space-between", 
          alignItems: "center", 
          height: "56px", 
          padding: "0 16px",
          width: "100%"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Link 
              to="/" 
              aria-label="Back to catalog" 
              style={{ 
                display: "grid", 
                placeItems: "center", 
                width: "36px", 
                height: "36px", 
                borderRadius: "50%", 
                color: "var(--ink)",
                cursor: "pointer",
                textDecoration: "none"
              }}
            >
              <ArrowLeft size={20} />
            </Link>
            <h1 style={{ fontSize: "16px", fontWeight: "700", color: "var(--ink)", margin: 0, display: "flex", alignItems: "center", gap: "6px" }}>
              <ShoppingBag size={18} style={{ color: "var(--coral)" }} />
              Admin
            </h1>
          </div>
          
          <button 
            type="button"
            onClick={handleSignOut}
            style={{
              background: "none",
              border: "none",
              color: "var(--muted)",
              fontSize: "13px",
              fontWeight: "600",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 12px",
              borderRadius: "6px",
              transition: "all 150ms ease"
            }}
          >
            <LogOut size={16} />
            Sign Out
          </button>
        </div>

        {/* Integrated Navigation Tabs */}
        <div className="admin-nav-tabs" style={{ padding: "0 16px", marginTop: "0" }}>
          <button
            type="button"
            className={`admin-nav-tab ${viewTab === "orders" ? "active" : ""}`}
            onClick={() => setViewTab("orders")}
          >
            <span>Orders Queue</span>
            {orders.filter(o => o.status === "pending").length > 0 && (
              <span style={{
                background: "var(--red, #ef4444)",
                color: "white",
                fontSize: "10px",
                padding: "1px 5px",
                borderRadius: "10px",
                fontWeight: "900",
                marginLeft: "4px"
              }}>
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
      </header>

      <div className="admin-container">
        {status && (
          <Alert variant={statusVariant} onClose={() => setStatus("")}>
            {status}
          </Alert>
        )}

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

        {viewTab === "settings" && (
          <div className="admin-settings-grid">
            <SettingsForm
              settings={booth}
              onSave={(settings) =>
                runAdminAction(async () => {
                  const saved = await saveBoothSettings(settings);
                  setBooth(saved);
                }, "Booth info saved.")
              }
            />
            <QrManager
              settings={payment}
              onSave={(settings) =>
                runAdminAction(async () => {
                  const saved = await savePaymentSettings(settings);
                  setPayment(saved);
                }, "QR settings saved.")
              }
            />
          </div>
        )}
      </div>
    </main>
  );
}
