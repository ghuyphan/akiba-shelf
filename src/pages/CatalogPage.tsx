import { useCallback, useEffect, useMemo, useState } from "react";
import { Clock, Facebook, Instagram, MapPin, Music2, ShoppingBag, Sparkles } from "lucide-react";
import { SOCIAL_BRAND_COLORS } from "../lib/social";
import { getCatalogData } from "../lib/api";
import { defaultPayment } from "../lib/constants";
import { getErrorMessage, isSessionNoise } from "../lib/errors";
import { subscribeToCatalogChanges } from "../lib/realtime";
import { applyPageTheme, getStoredBoothTheme, getThemeStyle } from "../lib/theme";
import type { BoothSettings, PaymentSettings, Product } from "../types/catalog";
import { CatalogHeader } from "../components/catalog/CatalogHeader";
import { CatalogToolbar } from "../components/catalog/CatalogToolbar";
import { CategoryFilters } from "../components/catalog/CategoryFilters";
import { BoothInfoPanel } from "../components/catalog/BoothInfoPanel";
import { PaymentQrModal } from "../components/catalog/PaymentQrModal";
import { ProductGrid } from "../components/catalog/ProductGrid";
import { SelectedItemPanel } from "../components/catalog/SelectedItemPanel";
import { SocialQrCard } from "../components/catalog/SocialQrCard";
import { Alert } from "../components/ui/Alert";
import { Modal } from "../components/ui/Modal";

export function CatalogPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [booth, setBooth] = useState<BoothSettings>(() => getStoredBoothTheme());
  const [payment, setPayment] = useState<PaymentSettings>(defaultPayment);
  const [selectedProduct, setSelectedProduct] = useState<Product>();
  const [selectedQuantity, setSelectedQuantity] = useState(1);
  const [activeCategory, setActiveCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
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
          if (!current) return undefined;
          return data.products.find((product) => product.id === current.id);
        });
        setLoadError("");
      })
      .catch((error) => {
        if (isSessionNoise(error)) return;
        setLoadError(getErrorMessage(error, "Could not load catalog."));
      });
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
      onStatus: () => undefined,
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
    let filtered =
      activeCategory === "All" ? products : products.filter((product) => product.category === activeCategory);

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(
        (product) =>
          product.name.toLowerCase().includes(q) ||
          product.item_code.toLowerCase().includes(q) ||
          (product.collection && product.collection.toLowerCase().includes(q)) ||
          (product.description && product.description.toLowerCase().includes(q))
      );
    }

    return [...filtered].sort((first, second) => {
      if (sort === "price-asc") return first.price_vnd - second.price_vnd;
      if (sort === "price-desc") return second.price_vnd - first.price_vnd;
      if (sort === "quantity") return second.quantity_available - first.quantity_available;
      if (sort === "name") return first.name.localeCompare(second.name);
      return first.sort_order - second.sort_order;
    });
  }, [activeCategory, products, sort, searchQuery]);

  return (
    <main className="app-shell" style={getThemeStyle(booth)}>
      <CatalogHeader booth={booth} onOpenInfo={() => setIsInfoOpen(true)} />
      {loadError && (
        <Alert variant="error" title="Catalog unavailable" onClose={() => setLoadError("")}>
          {loadError}
        </Alert>
      )}
      <div className="catalog-layout">
        <section className="catalog-main">
          <div className="catalog-controls">
            <CategoryFilters categories={categories} activeCategory={activeCategory} onChange={setActiveCategory} />
            <CatalogToolbar
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              sort={sort}
              viewMode={viewMode}
              onSortChange={setSort}
              onViewModeChange={setViewMode}
            />
          </div>
          <ProductGrid
            products={visibleProducts}
            totalProducts={products.length}
            activeCategory={activeCategory}
            selectedProduct={selectedProduct}
            viewMode={viewMode}
            onSelect={(product) => {
              const isSoldOut = product.quantity_available <= 0;
              if (!isSoldOut) {
                setSelectedProduct(product);
                setSelectedQuantity(1);
              }
            }}
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
          <div className="booth-info-header">
            <div className="booth-info-icon-wrap">
              {booth.logo_url ? (
                <img src={booth.logo_url} alt={booth.booth_name} className="booth-info-logo-img" />
              ) : (
                <ShoppingBag size={28} />
              )}
            </div>
            <div>
              <h3>{booth.booth_name || "Booth Details"}</h3>
              <p className="booth-code-pill">Booth {booth.booth_code}</p>
            </div>
          </div>

          <div className="booth-info-divider" />

          <div className="booth-info-list">
            <div className="booth-info-item">
              <MapPin size={18} />
              <div>
                <strong>Location</strong>
                <span>{booth.location || "Not specified"}</span>
              </div>
            </div>

            <div className="booth-info-item">
              <Clock size={18} />
              <div>
                <strong>Open Hours</strong>
                <span>{booth.open_hours || "Not specified"}</span>
              </div>
            </div>

            {payment.payment_instructions && (
              <div className="booth-info-item">
                <Sparkles size={18} />
                <div>
                  <strong>Instructions</strong>
                  <span>{payment.payment_instructions}</span>
                </div>
              </div>
            )}
          </div>

          {(() => {
            const modalSocialLinks = [
              { label: "Instagram", url: booth.instagram_url, icon: <Instagram size={18} /> },
              { label: "Facebook", url: booth.facebook_url, icon: <Facebook size={18} /> },
              { label: "TikTok", url: booth.tiktok_url, icon: <Music2 size={18} /> },
            ].filter((item) => item.url?.trim());

            if (modalSocialLinks.length === 0) return null;

            return (
              <>
                <div className="booth-info-divider" />
                <div className="booth-modal-social-section">
                  <strong className="booth-modal-social-title">Follow Us</strong>
                  <div className="booth-modal-social-grid">
                    {modalSocialLinks.map((item) => {
                      const brand = SOCIAL_BRAND_COLORS[item.label];
                      return (
                        <SocialQrCard
                          key={item.label}
                          label={item.label}
                          url={item.url!}
                          logoUrl={booth.social_qr_logo_url}
                          icon={item.icon}
                          brandColor={brand?.color}
                          brandGradient={brand?.gradient}
                        />
                      );
                    })}
                  </div>
                </div>
              </>
            );
          })()}
        </div>
      </Modal>
    </main>
  );
}
