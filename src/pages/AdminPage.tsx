import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Clock, LogOut, Package, ShoppingBag } from "lucide-react";
import {
  deleteProduct,
  getAdminProducts,
  getCatalogData,
  saveBoothSettings,
  savePaymentSettings,
  saveProduct,
  signInAdmin,
  signOutAdmin,
} from "../lib/api";
import { defaultBooth, defaultPayment } from "../lib/constants";
import { subscribeToCatalogChanges } from "../lib/realtime";
import { applyPageTheme, getThemeStyle } from "../lib/theme";
import { isSupabaseConfigured, supabase } from "../lib/supabase";
import type { BoothSettings, PaymentSettings, Product } from "../types/catalog";
import { LoginPanel } from "../components/admin/LoginPanel";
import { ProductForm } from "../components/admin/ProductForm";
import { ProductList } from "../components/admin/ProductList";
import { QrManager } from "../components/admin/QrManager";
import { SettingsForm } from "../components/admin/SettingsForm";
import { Alert } from "../components/ui/Alert";
import { Button } from "../components/ui/Button";

function createBlankProduct(nextSort: number): Product {
  return {
    id: crypto.randomUUID(),
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
  const [selectedProduct, setSelectedProduct] = useState<Product>();
  const [booth, setBooth] = useState<BoothSettings>(defaultBooth);
  const [payment, setPayment] = useState<PaymentSettings>(defaultPayment);
  const [status, setStatus] = useState("");
  const [statusVariant, setStatusVariant] = useState<"info" | "success" | "error">("info");

  const nextSort = useMemo(() => Math.max(0, ...products.map((product) => product.sort_order)) + 1, [products]);

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
    const [catalog, adminProducts] = await Promise.all([getCatalogData(), getAdminProducts()]);
    setBooth(catalog.booth);
    setPayment(catalog.payment);
    setProducts(adminProducts);
    setSelectedProduct((current) => current ?? adminProducts[0] ?? createBlankProduct(1));
  }

  useEffect(() => {
    if (!isAuthed) return;
    reload().catch((error) => {
      setStatusVariant("error");
      setStatus(error instanceof Error ? error.message : "Could not load admin data.");
    });
  }, [isAuthed]);

  useEffect(() => {
    if (!isAuthed) return undefined;

    let reloadTimer: number | undefined;
    const unsubscribe = subscribeToCatalogChanges({
      onChange: () => {
        window.clearTimeout(reloadTimer);
        reloadTimer = window.setTimeout(() => {
          reload().catch((error) => {
            setStatusVariant("error");
            setStatus(error instanceof Error ? error.message : "Could not refresh admin data.");
          });
        }, 150);
      },
      onStatus: (status, error) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setStatusVariant("error");
          setStatus(error instanceof Error ? error.message : "Realtime connection failed.");
        }
      },
    });

    return () => {
      window.clearTimeout(reloadTimer);
      unsubscribe();
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
      await saveProduct(product);
      await reload();
      setSelectedProduct(product);
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
              <Clock size={16} />
              Open {booth.open_hours}
            </span>
          </div>
        </div>
        <Button variant="secondary" icon={<LogOut size={18} />} onClick={handleSignOut}>
          Sign Out
        </Button>
      </header>
      {status && <Alert variant={statusVariant}>{status}</Alert>}
      <div className="admin-grid">
        <ProductList
          products={products}
          selectedId={selectedProduct?.id}
          onSelect={setSelectedProduct}
          onCreate={() => setSelectedProduct(createBlankProduct(nextSort))}
        />
        {selectedProduct && (
          <ProductForm product={selectedProduct} onSave={handleSaveProduct} onDelete={handleDeleteProduct} />
        )}
      </div>
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
    </main>
  );
}
