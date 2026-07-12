import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "../styles/catalog.css";
import { applyPageTheme, getThemeStyle } from "../lib/theme";
import type { Order, Product, StorefrontSection } from "../types/catalog";
import { CatalogLocaleProvider } from "../lib/catalogI18n";
import { CatalogHeader } from "../components/catalog/CatalogHeader";
import { CatalogToolbar } from "../components/catalog/CatalogToolbar";
import { CategoryFilters } from "../components/catalog/CategoryFilters";
import { BoothInfoPanel } from "../components/catalog/BoothInfoPanel";
import { PaymentQrModal } from "../components/catalog/PaymentQrModal";
import { ProductGrid } from "../components/catalog/ProductGrid";
import { ProductDetailModal } from "../components/catalog/ProductDetailModal";
import { SelectedItemPanel } from "../components/catalog/SelectedItemPanel";
import { StackedFeatured } from "../components/catalog/StackedFeatured";
import { Alert } from "../components/ui/Alert";
import { useToast } from "../components/ui/ToastProvider";
import { loadOrderRecovery } from "../lib/orderRecovery";
import { usePersistentCart } from "../hooks/usePersistentCart";
import { useCatalogData } from "../hooks/useCatalogData";
import { useAddToCartFeedback } from "../hooks/useAddToCartFeedback";
import { BoothDetailsModal, FlyingItemsLayer, PendingOrderBar } from "../components/catalog/CatalogOverlays";

type NetworkConnection = { effectiveType?: string; saveData?: boolean };

function prefersLightweightCatalog() {
  const connection = (navigator as Navigator & { connection?: NetworkConnection }).connection;
  return Boolean(connection?.saveData || connection?.effectiveType === "slow-2g" || connection?.effectiveType === "2g");
}

export function CatalogPage() {
  const toast = useToast();
  const [lightweightMode] = useState(prefersLightweightCatalog);
  const { cart, setCart, reconcileCart } = usePersistentCart();
  const { products, booth, payment, loadError, setLoadError, reloadAll: loadCatalog } = useCatalogData(reconcileCart);
  const { flyingItems, animateAdd } = useAddToCartFeedback(lightweightMode);
  const [online, setOnline] = useState(navigator.onLine);
  const [activeCategory, setActiveCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [sort, setSort] = useState("recommended");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [isQrOpen, setIsQrOpen] = useState(false);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const selectedFeedbackTimerRef = useRef<number | undefined>(undefined);
  const [detailProduct, setDetailProduct] = useState<Product | null>(null);
  const [isCartExpanded, setIsCartExpanded] = useState(false);
  const initialOrder = loadOrderRecovery()?.order ?? null;
  const [activeOrder, setActiveOrder] = useState<Order | null>(initialOrder);
  const activeOrderRef = useRef<Order | null>(initialOrder);

  useEffect(() => {
    const handleOnline = () => { setOnline(true); void loadCatalog(); };
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline); window.addEventListener("offline", handleOffline);
    return () => { window.removeEventListener("online", handleOnline); window.removeEventListener("offline", handleOffline); };
  }, [loadCatalog]);

  useEffect(() => {
    applyPageTheme(booth);
  }, [booth]);

  useEffect(() => {
    document.body.classList.add("catalog-screen");
    const handlePointerInput = () => document.body.classList.remove("catalog-keyboard-navigation");
    const handleKeyboardInput = (event: KeyboardEvent) => {
      if (event.key === "Tab") document.body.classList.add("catalog-keyboard-navigation");
    };
    document.addEventListener("pointerdown", handlePointerInput, true);
    document.addEventListener("keydown", handleKeyboardInput, true);
    return () => {
      document.body.classList.remove("catalog-screen", "catalog-keyboard-navigation");
      document.removeEventListener("pointerdown", handlePointerInput, true);
      document.removeEventListener("keydown", handleKeyboardInput, true);
      window.clearTimeout(selectedFeedbackTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (cart.length === 0) setIsCartExpanded(false);
  }, [cart.length]);

  const handleAddToCart = (product: Product, event?: React.MouseEvent) => {
    if (!product.active || product.quantity_available <= 0 || product.stock_status === "sold_out") {
      toast.error("This item is sold out and cannot be added to your cart.", "Item unavailable");
      return;
    }
    const currentItem = cart.find((item) => item.product.id === product.id);
    if (currentItem && currentItem.quantity >= product.quantity_available) {
      toast.info(`Only ${product.quantity_available} units are available.`, "Cart limit reached");
      return;
    }

    setSelectedProductId(product.id);
    window.clearTimeout(selectedFeedbackTimerRef.current);
    selectedFeedbackTimerRef.current = window.setTimeout(() => {
      setSelectedProductId((current) => current === product.id ? null : current);
    }, 650);
    setCart((prevCart) => {
      const existingIndex = prevCart.findIndex((item) => item.product.id === product.id);
      if (existingIndex > -1) {
        const nextQty = prevCart[existingIndex].quantity + 1;
        if (nextQty > product.quantity_available) return prevCart;
        const nextCart = [...prevCart];
        nextCart[existingIndex] = {
          ...nextCart[existingIndex],
          quantity: nextQty,
        };
        return nextCart;
      }
      return [...prevCart, { product, quantity: 1 }];
    });

    if (event) animateAdd(product, event);
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
    featured: <StackedFeatured products={products} onSelect={handleAddToCart} autoRotate={!lightweightMode && (booth.featured_autoplay ?? true)} />,
    controls: (
      <div className="catalog-controls" onClick={(event) => event.stopPropagation()}>
        <CategoryFilters categories={categories} activeCategory={activeCategory} onChange={setActiveCategory} />
        <CatalogToolbar searchQuery={searchQuery} onSearchChange={setSearchQuery} sort={sort} viewMode={viewMode} onSortChange={setSort} onViewModeChange={setViewMode} />
      </div>
    ),
    products: (
      <ProductGrid
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
          if (!online) { toast.info("Your cart is saved locally, but stock must be verified online before payment.", "Reconnect to checkout"); return; }
          setIsQrOpen(true);
          setIsCartExpanded(false);
        }}
        onClearCart={handleClearCart}
        isExpanded={isCartExpanded}
        onToggleExpand={() => setIsCartExpanded(!isCartExpanded)}
      />
    ),
  };
  const handleOrderChange = useCallback((nextOrder: Order | null) => {
    if (!activeOrderRef.current && nextOrder?.status === "pending") handleClearCart();
    activeOrderRef.current = nextOrder;
    setActiveOrder(nextOrder);
  }, []);

  const heroStorefrontSections = storefrontOrder.filter((section) => section === "featured" || section === "booth");
  const mainStorefrontSections = storefrontOrder.filter((section) => section === "controls" || section === "products");
  const sideStorefrontSections = storefrontOrder.filter((section) => section === "cart");
  const contentStorefrontColumns = [
    {
      key: "main",
      position: mainStorefrontSections.reduce((sum, section) => sum + storefrontOrder.indexOf(section), 0) / mainStorefrontSections.length,
      node: <section key="main" className="storefront-content-main">{mainStorefrontSections.map((section) => <div className={`storefront-module storefront-module-${section}`} key={section}>{storefrontBlocks[section]}</div>)}</section>,
    },
    {
      key: "side",
      position: storefrontOrder.indexOf("cart") - 0.01,
      node: <section key="side" className="storefront-content-side" onClick={(event) => event.stopPropagation()}>{sideStorefrontSections.map((section) => <div className={`storefront-module storefront-module-${section}`} key={section}>{storefrontBlocks[section]}</div>)}</section>,
    },
  ].sort((first, second) => first.position - second.position);

  return (
    <CatalogLocaleProvider locale={booth.catalog_locale ?? "en"}>
    <main className={`app-shell ${lightweightMode ? "catalog-lightweight" : ""}`} style={getThemeStyle(booth)} onClick={() => setSelectedProductId(null)}>
      <CatalogHeader booth={booth} onOpenInfo={() => setIsInfoOpen(true)} />
      {loadError && (
        <Alert variant="error" title="Catalog unavailable" onClose={() => setLoadError("")}>
          {loadError}
        </Alert>
      )}
      {!online && <Alert variant="info" title="You are offline.">Your cart is saved on this device. Reconnect to verify stock and continue checkout.</Alert>}
      <div className="catalog-layout storefront-layout-grid">
        <div className="storefront-hero-grid">
          {heroStorefrontSections.map((section) => <div className={`storefront-module storefront-module-${section}`} key={section} onClick={section === "booth" ? (event) => event.stopPropagation() : undefined}>{storefrontBlocks[section]}</div>)}
        </div>
        <div className="storefront-content-grid">
          {contentStorefrontColumns.map((column) => column.node)}
        </div>
      </div>
      {activeOrder?.status === "pending" && <PendingOrderBar order={activeOrder} onOpen={() => setIsQrOpen(true)} />}
      <PaymentQrModal
        isOpen={isQrOpen}
        payment={payment}
        cart={cart}
        onClose={() => setIsQrOpen(false)}
        onSuccess={() => void loadCatalog()}
        onOrderChange={handleOrderChange}
      />
      <ProductDetailModal product={detailProduct} onClose={() => { setDetailProduct(null); setSelectedProductId(null); }} onAddToCart={handleAddToCart} />
      <BoothDetailsModal booth={booth} payment={payment} open={isInfoOpen} onClose={() => setIsInfoOpen(false)} />
      <FlyingItemsLayer items={flyingItems} />
    </main>
    </CatalogLocaleProvider>
  );
}
