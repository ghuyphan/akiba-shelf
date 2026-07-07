import { useCallback, useEffect, useMemo, useState } from "react";
import { Info } from "lucide-react";
import { getCatalogData } from "../lib/api";
import { defaultBooth, defaultPayment } from "../lib/constants";
import { subscribeToCatalogChanges } from "../lib/realtime";
import { applyPageTheme, getThemeStyle } from "../lib/theme";
import type { BoothSettings, PaymentSettings, Product } from "../types/catalog";
import { CatalogHeader } from "../components/catalog/CatalogHeader";
import { CatalogToolbar } from "../components/catalog/CatalogToolbar";
import { CategoryFilters } from "../components/catalog/CategoryFilters";
import { BoothInfoPanel } from "../components/catalog/BoothInfoPanel";
import { PaymentQrModal } from "../components/catalog/PaymentQrModal";
import { ProductGrid } from "../components/catalog/ProductGrid";
import { SelectedItemPanel } from "../components/catalog/SelectedItemPanel";
import { Alert } from "../components/ui/Alert";
import { Modal } from "../components/ui/Modal";

export function CatalogPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [booth, setBooth] = useState<BoothSettings>(defaultBooth);
  const [payment, setPayment] = useState<PaymentSettings>(defaultPayment);
  const [selectedProduct, setSelectedProduct] = useState<Product>();
  const [selectedQuantity, setSelectedQuantity] = useState(1);
  const [activeCategory, setActiveCategory] = useState("All");
  const [sort, setSort] = useState("recommended");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [isQrOpen, setIsQrOpen] = useState(false);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [loadError, setLoadError] = useState("");

  const loadCatalog = useCallback(() => {
    return getCatalogData()
      .then((data) => {
        setProducts(data.products);
        setBooth(data.booth);
        setPayment(data.payment);
        setSelectedProduct((current) => {
          if (!current) return data.products[0];
          return data.products.find((product) => product.id === current.id) ?? data.products[0];
        });
        setLoadError("");
      })
      .catch((error) => setLoadError(error instanceof Error ? error.message : "Could not load catalog."));
  }, []);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  useEffect(() => {
    let reloadTimer: number | undefined;

    const unsubscribe = subscribeToCatalogChanges({
      onChange: () => {
        window.clearTimeout(reloadTimer);
        reloadTimer = window.setTimeout(() => void loadCatalog(), 150);
      },
      onStatus: (status, error) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setLoadError(error instanceof Error ? error.message : "Realtime connection failed.");
        }
      },
    });

    return () => {
      window.clearTimeout(reloadTimer);
      unsubscribe();
    };
  }, [loadCatalog]);

  useEffect(() => {
    applyPageTheme(booth);
  }, [booth]);

  useEffect(() => {
    setSelectedQuantity(1);
  }, [selectedProduct?.id]);

  const categories = useMemo(
    () => ["All", ...Array.from(new Set(products.map((product) => product.category))).filter(Boolean)],
    [products],
  );

  const visibleProducts = useMemo(() => {
    const filtered =
      activeCategory === "All" ? products : products.filter((product) => product.category === activeCategory);

    return [...filtered].sort((first, second) => {
      if (sort === "price-asc") return first.price_vnd - second.price_vnd;
      if (sort === "price-desc") return second.price_vnd - first.price_vnd;
      if (sort === "quantity") return second.quantity_available - first.quantity_available;
      if (sort === "name") return first.name.localeCompare(second.name);
      return first.sort_order - second.sort_order;
    });
  }, [activeCategory, products, sort]);

  return (
    <main className="app-shell" style={getThemeStyle(booth)}>
      <CatalogHeader booth={booth} onOpenPayment={() => setIsQrOpen(true)} onOpenInfo={() => setIsInfoOpen(true)} />
      {loadError && (
        <Alert variant="error" title="Catalog unavailable" onClose={() => setLoadError("")}>
          {loadError}
        </Alert>
      )}
      <div className="catalog-layout">
        <section className="catalog-main">
          <div className="catalog-controls">
            <CategoryFilters categories={categories} activeCategory={activeCategory} onChange={setActiveCategory} />
            <CatalogToolbar sort={sort} viewMode={viewMode} onSortChange={setSort} onViewModeChange={setViewMode} />
          </div>
          <ProductGrid
            products={visibleProducts}
            totalProducts={products.length}
            activeCategory={activeCategory}
            selectedProduct={selectedProduct}
            viewMode={viewMode}
            onSelect={setSelectedProduct}
            onResetFilters={() => setActiveCategory("All")}
          />
        </section>
        <section className="catalog-side">
          <SelectedItemPanel
            product={selectedProduct}
            payment={payment}
            quantity={selectedQuantity}
            onQuantityChange={setSelectedQuantity}
            onOpenPayment={() => setIsQrOpen(true)}
            onClose={() => setSelectedProduct(undefined)}
          />
          <BoothInfoPanel booth={booth} />
        </section>
      </div>
      <PaymentQrModal
        isOpen={isQrOpen}
        payment={payment}
        product={selectedProduct}
        quantity={selectedQuantity}
        onClose={() => setIsQrOpen(false)}
      />
      <Modal title="Booth Info" isOpen={isInfoOpen} onClose={() => setIsInfoOpen(false)}>
        <div className="booth-info-modal">
          <Info size={30} />
          <h3>Booth {booth.booth_code}</h3>
          <p>{booth.location}</p>
          <p>Open {booth.open_hours}</p>
          <p>{payment.payment_instructions}</p>
        </div>
      </Modal>
    </main>
  );
}
