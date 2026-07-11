import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import "../styles/catalog.css";
import { Check, Clock, Facebook, Instagram, MapPin, ShoppingBag, Sparkles } from "lucide-react";
import { SOCIAL_BRAND_COLORS } from "../lib/social";
import { getCatalogData } from "../lib/api";
import { defaultPayment } from "../lib/constants";
import { getErrorMessage, isSessionNoise } from "../lib/errors";
import { subscribeToCatalogChanges } from "../lib/realtime";
import { applyPageTheme, getStoredBoothTheme, getThemeStyle } from "../lib/theme";
import type { BoothSettings, CartItem, PaymentSettings, Product, StorefrontSection } from "../types/catalog";
import { CatalogLocaleProvider } from "../lib/catalogI18n";
import { TiktokIcon } from "../components/ui/TiktokIcon";
import { CatalogHeader } from "../components/catalog/CatalogHeader";
import { CatalogToolbar } from "../components/catalog/CatalogToolbar";
import { CategoryFilters } from "../components/catalog/CategoryFilters";
import { BoothInfoPanel } from "../components/catalog/BoothInfoPanel";
import { PaymentQrModal } from "../components/catalog/PaymentQrModal";
import { ProductGrid } from "../components/catalog/ProductGrid";
import { ProductDetailModal } from "../components/catalog/ProductDetailModal";
import { SelectedItemPanel } from "../components/catalog/SelectedItemPanel";
import { StackedFeatured } from "../components/catalog/StackedFeatured";
import { SocialQrCard } from "../components/catalog/SocialQrCard";
import { Alert } from "../components/ui/Alert";
import { Modal } from "../components/ui/Modal";
import { safeUuid } from "../lib/supabase";
import { useToast } from "../components/ui/ToastProvider";

type FlyingItem = {
  id: string;
  imageUrl: string;
  startX: number;
  startY: number;
  tx: number;
  ty: number;
  tyHalf: number;
};

export function CatalogPage() {
  const toast = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [booth, setBooth] = useState<BoothSettings>(() => getStoredBoothTheme());
  const [payment, setPayment] = useState<PaymentSettings>(defaultPayment);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [activeCategory, setActiveCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [sort, setSort] = useState("recommended");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [isQrOpen, setIsQrOpen] = useState(false);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [detailProduct, setDetailProduct] = useState<Product | null>(null);
  const [flyingItems, setFlyingItems] = useState<FlyingItem[]>([]);
  const [isCartExpanded, setIsCartExpanded] = useState(false);
  const [isCartBackdropMounted, setIsCartBackdropMounted] = useState(false);

  const loadCatalog = useCallback(() => {
    return getCatalogData()
      .then((data) => {
        setProducts(data.products);
        setBooth(data.booth);
        setPayment(data.payment);
        setCart((currentCart) => {
          return currentCart
            .map((item) => {
              const freshProduct = data.products.find((p) => p.id === item.product.id);
              if (!freshProduct || freshProduct.quantity_available <= 0) return null;
              const nextQty = Math.min(item.quantity, freshProduct.quantity_available);
              return { product: freshProduct, quantity: nextQty };
            })
            .filter((item): item is CartItem => item !== null);
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
    if (cart.length === 0) setIsCartExpanded(false);
  }, [cart.length]);

  useEffect(() => {
    let exitTimer: number | undefined;
    if (isCartExpanded) {
      setIsCartBackdropMounted(true);
    } else {
      exitTimer = window.setTimeout(() => setIsCartBackdropMounted(false), 240);
    }
    return () => window.clearTimeout(exitTimer);
  }, [isCartExpanded]);

  const handleAddToCart = (product: Product, event?: React.MouseEvent) => {
    if (!product.active || product.quantity_available <= 0 || product.stock_status === "sold_out") {
      toast.error("This item is sold out and cannot be added to your cart.", "Item unavailable");
      return;
    }

    setSelectedProductId(product.id);
    setCart((prevCart) => {
      const existingIndex = prevCart.findIndex((item) => item.product.id === product.id);
      if (existingIndex > -1) {
        const nextQty = prevCart[existingIndex].quantity + 1;
        if (nextQty > product.quantity_available) {
          toast.info(`Only ${product.quantity_available} units are available.`, "Cart limit reached");
          return prevCart;
        }
        const nextCart = [...prevCart];
        nextCart[existingIndex] = {
          ...nextCart[existingIndex],
          quantity: nextQty,
        };
        return nextCart;
      }
      return [...prevCart, { product, quantity: 1 }];
    });

    if (event) {
      const imageUrl = product.images[0] || "";
      const startX = event.clientX;
      const startY = event.clientY;
      const id = safeUuid();

      const targetElement = document.querySelector(".catalog-side .selected-panel");
      let targetX = window.innerWidth - 180;
      let targetY = 250;
      if (targetElement) {
        const rect = targetElement.getBoundingClientRect();
        targetX = rect.left + rect.width * 0.5;
        targetY = rect.top + 54;
      }

      const tx = targetX - startX;
      const ty = targetY - startY;
      const tyHalf = Math.min(ty * 0.45, -90);

      setFlyingItems((current) => [
        ...current,
        { id, imageUrl, startX, startY, tx, ty, tyHalf },
      ]);

      setTimeout(() => {
        setFlyingItems((current) => current.filter((item) => item.id !== id));
      }, 800);
    }
  };

  const handleUpdateCartQuantity = (productId: string, quantity: number) => {
    setCart((prevCart) =>
      prevCart
        .map((item) => {
          if (item.product.id === productId) {
            const maxQty = Math.max(1, item.product.quantity_available);
            const newQty = Math.min(maxQty, Math.max(1, quantity));
            return { ...item, quantity: newQty };
          }
          return item;
        })
    );
  };

  const handleRemoveFromCart = (productId: string) => {
    setCart((prevCart) => prevCart.filter((item) => item.product.id !== productId));
    if (selectedProductId === productId) {
      setSelectedProductId(null);
    }
  };

  const handleClearCart = () => {
    setCart([]);
    setSelectedProductId(null);
    setIsCartExpanded(false);
  };

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
      
      // Default / Recommended: sort featured first, then by sort_order
      if (first.featured && !second.featured) return -1;
      if (!first.featured && second.featured) return 1;
      return first.sort_order - second.sort_order;
    });
  }, [activeCategory, products, sort, searchQuery]);

  const storefrontOrder = useMemo<StorefrontSection[]>(() => {
    const fallback: StorefrontSection[] = ["featured", "booth", "controls", "cart", "products"];
    const saved = booth.layout_order;
    return saved?.length === fallback.length && fallback.every((section) => saved.includes(section)) ? saved : fallback;
  }, [booth.layout_order]);

  const storefrontBlocks: Record<StorefrontSection, React.ReactNode> = {
    featured: <StackedFeatured products={products} onSelect={handleAddToCart} />,
    controls: (
      <div className="catalog-controls" onClick={(event) => event.stopPropagation()}>
        <CategoryFilters categories={categories} activeCategory={activeCategory} onChange={setActiveCategory} />
        <CatalogToolbar searchQuery={searchQuery} onSearchChange={setSearchQuery} sort={sort} viewMode={viewMode} onSortChange={setSort} onViewModeChange={setViewMode} />
      </div>
    ),
    products: (
      <ProductGrid
        key={`grid-${activeCategory}-${sort}-${searchQuery.trim()}-${viewMode}`}
        products={visibleProducts}
        totalProducts={products.length}
        activeCategory={activeCategory}
        selectedProduct={products.find((p) => p.id === selectedProductId)}
        viewMode={viewMode}
        onSelect={handleAddToCart}
        onViewDetails={setDetailProduct}
        onResetFilters={() => setActiveCategory("All")}
      />
    ),
    booth: <BoothInfoPanel booth={booth} />,
    cart: (
      <SelectedItemPanel
        cart={cart}
        onQuantityChange={handleUpdateCartQuantity}
        onRemove={handleRemoveFromCart}
        onOpenPayment={() => {
          setIsQrOpen(true);
          setIsCartExpanded(false);
        }}
        onClearCart={handleClearCart}
        isExpanded={isCartExpanded}
        onToggleExpand={() => setIsCartExpanded(!isCartExpanded)}
      />
    ),
  };
  const heroStorefrontSections = storefrontOrder.filter((section) => section === "featured" || section === "booth");
  const mainStorefrontSections = storefrontOrder.filter((section) => section === "controls" || section === "products");
  const sideStorefrontSections = storefrontOrder.filter((section) => section === "cart");
  return (
    <CatalogLocaleProvider locale={booth.catalog_locale ?? "en"}>
    <main className="app-shell" style={getThemeStyle(booth)} onClick={() => setSelectedProductId(null)}>
      <CatalogHeader booth={booth} onOpenInfo={() => setIsInfoOpen(true)} />
      {loadError && (
        <Alert variant="error" title="Catalog unavailable" onClose={() => setLoadError("")}>
          {loadError}
        </Alert>
      )}
      <div className="catalog-layout storefront-layout-grid">
        <div className="storefront-hero-grid">
          {heroStorefrontSections.map((section) => <div className={`storefront-module storefront-module-${section}`} key={section} onClick={section === "booth" ? (event) => event.stopPropagation() : undefined}>{storefrontBlocks[section]}</div>)}
        </div>
        <div className="storefront-content-grid">
          <section className="storefront-content-main">{mainStorefrontSections.map((section) => <div className={`storefront-module storefront-module-${section}`} key={section}>{storefrontBlocks[section]}</div>)}</section>
          <section className="storefront-content-side" onClick={(event) => event.stopPropagation()}>{sideStorefrontSections.map((section) => <div className={`storefront-module storefront-module-${section}`} key={section}>{storefrontBlocks[section]}</div>)}</section>
        </div>
      </div>
      {isCartBackdropMounted && (
        <div className={`bottomsheet-backdrop ${isCartExpanded ? "is-open" : "is-closing"}`} onClick={() => setIsCartExpanded(false)} />
      )}
      <PaymentQrModal
        isOpen={isQrOpen}
        payment={payment}
        cart={cart}
        onClose={() => setIsQrOpen(false)}
        onSuccess={handleClearCart}
      />
      <ProductDetailModal product={detailProduct} onClose={() => setDetailProduct(null)} onAddToCart={handleAddToCart} />
      <Modal title="Booth details" isOpen={isInfoOpen} onClose={() => setIsInfoOpen(false)} className="booth-info-modal-container booth-modal-redesign">
        <div className="booth-info-modal booth-modal-content">
          <div className="booth-modal-hero">
            <div className="booth-info-icon-wrap booth-modal-logo">
              {booth.logo_url ? (
                <img src={booth.logo_url} alt={booth.booth_name} className="booth-info-logo-img" />
              ) : (
                <ShoppingBag size={28} />
              )}
            </div>
            <div className="booth-modal-identity">
              <span className="booth-modal-eyebrow">You’re shopping at</span>
              <h3>{booth.booth_name || "Booth Details"}</h3>
              <p>{booth.subtitle || "Independent merch booth"}</p>
            </div>
            <span className="booth-code-pill">Booth {booth.booth_code}</span>
          </div>

          <div className="booth-modal-facts">
            <div>
              <MapPin size={18} />
              <span><small>Location</small><strong>{booth.location || "Not specified"}</strong></span>
            </div>
            <div>
              <Clock size={18} />
              <span><small>Open hours</small><strong>{booth.open_hours || "Not specified"}</strong></span>
            </div>
          </div>

          {payment.payment_instructions && <div className="booth-modal-note"><Sparkles size={18} /><div><strong>Before you pay</strong><span>{payment.payment_instructions}</span></div></div>}

          {(() => {
            const modalSocialLinks = [
              { label: "Instagram", url: booth.instagram_url, icon: <Instagram size={18} /> },
              { label: "Facebook", url: booth.facebook_url, icon: <Facebook size={18} /> },
              { label: "TikTok", url: booth.tiktok_url, icon: <TiktokIcon size={18} /> },
            ].filter((item) => item.url?.trim());

            if (modalSocialLinks.length === 0) return null;

            return (
              <>
                <div className="booth-modal-social-section">
                  <div className="booth-modal-section-heading"><span>Find us online</span><strong>Follow the booth</strong></div>
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

      {createPortal(flyingItems.map((item) => (
        <div
          key={item.id}
          className="flying-product-item"
          style={{
            left: item.startX - 36,
            top: item.startY - 41,
            ...({
              "--tx": `${item.tx}px`,
              "--ty": `${item.ty}px`,
              "--tx-half": `${item.tx * 0.5}px`,
              "--ty-half": `${item.tyHalf}px`
            } as React.CSSProperties)
          }}
          aria-hidden="true"
        >
          {item.imageUrl ? <img src={item.imageUrl} alt="" /> : <ShoppingBag size={24} />}
          <span><Check size={13} /></span>
        </div>
      )), document.body)}
    </main>
    </CatalogLocaleProvider>
  );
}
