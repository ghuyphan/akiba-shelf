import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Clock, EyeOff, LogOut, Package, ShoppingBag, Sparkles, TriangleAlert } from "lucide-react";
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
      <header className="admin-header">
        <div className="admin-heading">
          <Link to="/" className="back-link" aria-label="Back to catalog">
            <ArrowLeft size={18} />
            Catalog
          </Link>
          <div className="admin-title-row">
            <div className="brand-mark">
              <ShoppingBag size={30} />
            </div>
            <div>
              <h1>Merch Admin</h1>
              <p>Update booth details, item uploads, and payment QR settings.</p>
            </div>
          </div>
          <div className="admin-metrics" aria-label="Catalog summary">
            <span>
              <Package size={16} />
              {products.length} items
            </span>
            <span>
              <Sparkles size={16} />
              {products.filter((product) => product.featured).length} featured
            </span>
            <span>
              <TriangleAlert size={16} />
              {lowStockCount} attention
            </span>
            <span>
              <EyeOff size={16} />
              {hiddenCount} hidden
            </span>
            <span>
              <Clock size={16} />
              Open {booth.open_hours}
            </span>
          </div>
        </div>
        <Button variant="secondary" icon={<LogOut size={18} />} onClick={handleSignOut}>
          Sign Out
        </Button>
      </header>
      {status && (
        <Alert variant={statusVariant} onClose={() => setStatus("")}>
          {status}
        </Alert>
      )}

      {/* Main Tab Controls */}
      <div 
        className="category-row" 
        style={{ 
          display: "flex", 
          gap: "10px", 
          marginBottom: "20px", 
          paddingBottom: "4px", 
          flexWrap: "nowrap",
          overflowX: "auto",
          scrollbarWidth: "none"
        }}
      >
        <button
          type="button"
          className={`chip ${viewTab === "orders" ? "chip-active" : ""}`}
          onClick={() => setViewTab("orders")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px"
          }}
        >
          <span>Orders Queue</span>
          {orders.filter(o => o.status === "pending").length > 0 && (
            <span style={{
              background: viewTab === "orders" ? "white" : "var(--red, #ef4444)",
              color: viewTab === "orders" ? "var(--navy)" : "white",
              fontSize: "11.5px",
              padding: "2px 7px",
              borderRadius: "10px",
              fontWeight: "900"
            }}>
              {orders.filter(o => o.status === "pending").length}
            </span>
          )}
        </button>
        <button
          type="button"
          className={`chip ${viewTab === "products" ? "chip-active" : ""}`}
          onClick={() => setViewTab("products")}
        >
          Products ({products.length})
        </button>
        <button
          type="button"
          className={`chip ${viewTab === "settings" ? "chip-active" : ""}`}
          onClick={() => setViewTab("settings")}
        >
          Settings
        </button>
      </div>

      {viewTab === "orders" && (
        <OrderQueue orders={orders} onOrderUpdated={() => reload().catch(console.error)} />
      )}

      {viewTab === "products" && (
        <>
          <div className="admin-mobile-tabs">
            <button
              type="button"
              className={`admin-tab-btn ${activeTab === "list" ? "active" : ""}`}
              onClick={() => setActiveTab("list")}
            >
              Products List ({products.length})
            </button>
            <button
              type="button"
              className={`admin-tab-btn ${activeTab === "form" ? "active" : ""}`}
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
    </main>
  );
}
