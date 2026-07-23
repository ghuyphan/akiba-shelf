import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { CloudOff } from "lucide-react";
import "../styles/catalog.css";
import {
  applyPageTheme,
  getStorefrontSectionStyleClass,
  getThemeStyle,
  resetPageTheme,
} from "../utils/theme";
import { getShopBranding, useDocumentBranding } from "../lib/branding";
import { applyDocumentSeo } from "../lib/seo";
import type { Order, Product, StorefrontSection } from "../types/catalog";
import {
  CatalogLocaleProvider,
  translations,
  useCatalogCopy,
} from "../lib/i18n/catalogI18n";
import { PromotionProvider } from "../lib/promotionContext";
import { CatalogHeader } from "../components/catalog/CatalogHeader";
import { CatalogToolbar } from "../components/catalog/CatalogToolbar";
import { CategoryFilters } from "../components/catalog/CategoryFilters";
import { BoothInfoPanel } from "../components/catalog/BoothInfoPanel";
import { ProductGrid } from "../components/catalog/ProductGrid";
import { ProductDetailModal } from "../components/catalog/ProductDetailModal";
import { SelectedItemPanel } from "../components/catalog/SelectedItemPanel";
import { StackedFeatured } from "../components/catalog/StackedFeatured";
import { ToastLocalization, useToast } from "../components/ui/ToastProvider";
import { loadCheckoutSession } from "../lib/offline/checkoutSession";
import {
  loadShopSnapshot,
  saveShopSnapshot,
  loadCatalogSnapshot,
} from "../lib/offline/offline";
import { usePersistentCart } from "../hooks/usePersistentCart";
import { useCatalogData } from "../hooks/useCatalogData";
import { useAddToCartFeedback } from "../hooks/useAddToCartFeedback";
import {
  BoothDetailsModal,
  FloatingCartBar,
  FlyingItemsLayer,
  PendingOrderBar,
} from "../components/catalog/CatalogOverlays";
import { layoutOrderSchema } from "../lib/schemas";
import { PageLoading } from "../components/ui/PageLoading";
import { useParams } from "react-router-dom";
import { getPublicShop } from "../lib/api/shops";
import type { PublicProductSort } from "../lib/catalogQueries";
import type { Shop } from "../types/catalog";
import {
  calculateCartPricing,
  normalizePromotionRewards,
} from "../utils/pricing";
import { prefersLightweightCatalog } from "../lib/network";
import { ErrorBoundary } from "../components/ui/ErrorBoundary";
import { lazyWithRetry } from "../utils/lazyWithRetry";
import { hasUsablePayment } from "../utils/vietqr";
import { getUserFacingErrorMessage } from "../lib/errors";

const ShopUnavailablePage = lazy(() =>
  import("./ShopUnavailablePage").then((module) => ({
    default: module.ShopUnavailablePage,
  })),
);

const PaymentQrModal = lazyWithRetry("PaymentQrModal", () =>
  import("../components/catalog/PaymentQrModal").then((module) => ({
    default: module.PaymentQrModal,
  })),
);

function CatalogToastLocalization() {
  const copy = useCatalogCopy();
  return (
    <ToastLocalization
      labels={{
        successTitle: copy.toastSuccessTitle,
        errorTitle: copy.toastErrorTitle,
        infoTitle: copy.toastInfoTitle,
        dismiss: copy.dismissNotification,
      }}
    />
  );
}

export function CatalogPage() {
  const { shopSlug = "" } = useParams();
  const toast = useToast();
  const [shop, setShop] = useState<Shop | null | undefined>(
    () => loadShopSnapshot(shopSlug) ?? undefined,
  );
  const [shopLoadError, setShopLoadError] = useState("");
  const [lightweightMode] = useState(prefersLightweightCatalog);
  const [activeCategory, setActiveCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sort, setSort] = useState<PublicProductSort>("recommended");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const { cart, setCart, reconcileCart } = usePersistentCart(shopSlug);

  useEffect(() => {
    if (cart.length > 0) {
      void import("../components/catalog/PaymentQrModal").catch(() => {});
    }
  }, [cart.length]);
  const catalogShopId = shop?.catalog_source_shop_id ?? shop?.id;
  const orderingEnabled = shop?.accepting_orders !== false;
  const cartProductIdsKey = JSON.stringify(cart.map((item) => item.product.id));
  const cartProductIds = useMemo(
    () => JSON.parse(cartProductIdsKey) as string[],
    [cartProductIdsKey],
  );
  const catalogQuery = useMemo(
    () => ({ category: activeCategory, search: debouncedSearch, sort }),
    [activeCategory, debouncedSearch, sort],
  );
  const {
    products,
    featuredProducts,
    categories: catalogCategories,
    booth: catalogBooth,
    payment,
    promotion,
    rewardProducts,
    hasMore,
    loadError,
    isLoading,
    isInitialLoading,
    isLoadingMore,
    loadMore,
    reloadAll: loadCatalog,
    ensurePayment,
    gachaEnabled,
  } = useCatalogData(
    catalogShopId,
    catalogQuery,
    cartProductIds,
    reconcileCart,
    orderingEnabled,
  );
  useEffect(() => {
    if (cart.length === 0 || !orderingEnabled) return;
    void ensurePayment().catch(() => {
      // Checkout surfaces the actionable error if the warm-up request fails.
    });
  }, [cart.length, ensurePayment, orderingEnabled]);
  const booth = useMemo(
    () =>
      shop?.catalog_source_shop_id
        ? { ...catalogBooth, booth_name: shop.name, booth_code: "DEMO" }
        : catalogBooth,
    [catalogBooth, shop?.catalog_source_shop_id, shop?.name],
  );
  const catalogCopy = translations[booth.catalog_locale ?? "en"];
  // Latest-copy ref for stable callbacks: the loaded booth locale flips
  // catalogCopy once (default -> shop locale), and loadShop must not refire
  // (and reset the shop back to undefined) when that happens.
  const catalogCopyRef = useRef(catalogCopy);
  useEffect(() => {
    catalogCopyRef.current = catalogCopy;
  }, [catalogCopy]);
  const { flyingItems, animateAdd } = useAddToCartFeedback(lightweightMode);
  const initialCheckoutRef = useRef(loadCheckoutSession(shopSlug));
  const [online, setOnline] = useState(navigator.onLine);
  const [isQrOpen, setIsQrOpen] = useState(false);
  const [paymentModalRequested, setPaymentModalRequested] = useState(
    Boolean(initialCheckoutRef.current),
  );
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(
    null,
  );
  const selectedFeedbackTimerRef = useRef<number | undefined>(undefined);
  const [detailProduct, setDetailProduct] = useState<Product | null>(null);
  const [isCartExpanded, setIsCartExpanded] = useState(false);
  const [isFloatingCartVisible, setIsFloatingCartVisible] = useState(false);
  const cartModuleRef = useRef<HTMLDivElement>(null);
  const initialOrder = initialCheckoutRef.current?.order ?? null;
  const [activeOrder, setActiveOrder] = useState<Order | null>(initialOrder);
  const activeOrderRef = useRef<Order | null>(initialOrder);
  const verifiedBranding =
    shop &&
    shop.slug === shopSlug &&
    catalogBooth.shop_id === catalogShopId &&
    !isInitialLoading &&
    !loadError
      ? getShopBranding(
          shop.name,
          booth.booth_name,
          booth.logo_url,
          booth.theme_background,
        )
      : null;
  useDocumentBranding(verifiedBranding);
  useEffect(() => {
    const shopName = booth.booth_name.trim() || shop?.name.trim() || "Shop";
    applyDocumentSeo({
      description:
        booth.subtitle.trim() ||
        `Browse products and place an order from ${shopName} on Matsuri.`,
      canonicalPath: `/s/${encodeURIComponent(shopSlug)}`,
      robots: verifiedBranding ? "index, follow" : "noindex, nofollow",
      type: "profile",
    });
  }, [
    booth.booth_name,
    booth.subtitle,
    shop?.name,
    shopSlug,
    verifiedBranding,
  ]);

  useEffect(() => {
    const restored = loadCheckoutSession(shopSlug);
    const next = restored?.order ?? null;
    setActiveOrder(next);
    activeOrderRef.current = next;
    setIsQrOpen(false);
    setPaymentModalRequested(Boolean(restored));
  }, [shopSlug]);

  useEffect(() => {
    if (activeOrder?.status === "pending") {
      setPaymentModalRequested(true);
    }
  }, [activeOrder?.status]);

  const loadShop = useCallback(async () => {
    const cachedShop = loadShopSnapshot(shopSlug);
    if (!cachedShop) {
      setShop(undefined);
    }
    setShopLoadError("");
    try {
      const freshShop = await getPublicShop(shopSlug);
      setOnline(true);
      setShop(freshShop);
      if (freshShop) {
        saveShopSnapshot(freshShop, shopSlug);
      }
    } catch (error) {
      if (!cachedShop) {
        setShop(null);
      }
      setShopLoadError(
        getUserFacingErrorMessage(
          error,
          catalogCopyRef.current.shopConnectError,
        ),
      );
    }
  }, [shopSlug]);

  useEffect(() => {
    void loadShop();
  }, [loadShop]);

  const prepareGacha = useCallback(() => {
    if (!shop || !catalogShopId) return;
    void import("./GachaPage");
    void import("../lib/gacha/gachaLaunch")
      .then(({ prepareGachaLaunch }) => {
        void prepareGachaLaunch(
          shopSlug,
          { shop, booth: catalogBooth },
          !lightweightMode,
        );
      })
      .catch(() => {
        // Navigation owns user-facing launch errors; intent prefetch stays silent.
      });
  }, [catalogBooth, catalogShopId, lightweightMode, shop, shopSlug]);

  useEffect(() => {
    const handleOnline = () => {
      setOnline(true);
      void loadCatalog();
    };
    const handleOffline = () => setOnline(false);
    const handleFocus = () => setOnline(navigator.onLine);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("focus", handleFocus);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("focus", handleFocus);
    };
  }, [loadCatalog]);

  useEffect(() => {
    const cartModule = cartModuleRef.current;
    const mobile = window.matchMedia("(max-width: 760px)");
    if (!cartModule || cart.length === 0 || mobile.matches) {
      setIsFloatingCartVisible(false);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => setIsFloatingCartVisible(!entry.isIntersecting),
      { rootMargin: "-84px 0px -18px", threshold: 0.08 },
    );
    observer.observe(cartModule);
    const handleBreakpoint = () => {
      if (mobile.matches) setIsFloatingCartVisible(false);
      else {
        observer.unobserve(cartModule);
        observer.observe(cartModule);
      }
    };
    mobile.addEventListener("change", handleBreakpoint);
    return () => {
      mobile.removeEventListener("change", handleBreakpoint);
      observer.disconnect();
    };
  }, [cart.length]);

  useEffect(() => {
    if (!verifiedBranding) return;
    applyPageTheme(booth, `slug:${shopSlug}`);
    return () => resetPageTheme();
  }, [booth, shopSlug, verifiedBranding]);

  useEffect(() => {
    if (!loadError) return;
    toast.error(loadError, catalogCopyRef.current.catalogUnavailableTitle);
  }, [loadError, toast]);

  useEffect(() => {
    document.body.classList.add("catalog-screen");
    const handlePointerInput = () =>
      document.body.classList.remove("catalog-keyboard-navigation");
    const handleKeyboardInput = (event: KeyboardEvent) => {
      if (event.key === "Tab")
        document.body.classList.add("catalog-keyboard-navigation");
    };
    document.addEventListener("pointerdown", handlePointerInput, true);
    document.addEventListener("keydown", handleKeyboardInput, true);
    return () => {
      document.body.classList.remove(
        "catalog-screen",
        "catalog-keyboard-navigation",
      );
      document.removeEventListener("pointerdown", handlePointerInput, true);
      document.removeEventListener("keydown", handleKeyboardInput, true);
      window.clearTimeout(selectedFeedbackTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (cart.length === 0) setIsCartExpanded(false);
  }, [cart.length]);

  useEffect(() => {
    const timer = window.setTimeout(
      () => setDebouncedSearch(searchQuery.trim()),
      250,
    );
    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  // Keep the latest cart readable from stable callbacks so memoized children
  // do not re-render when only cart contents change.
  const cartRef = useRef(cart);
  useEffect(() => {
    cartRef.current = cart;
  }, [cart]);

  const handleAddToCart = useCallback(
    (product: Product, event?: React.MouseEvent) => {
      if (
        !product.active ||
        product.quantity_available <= 0 ||
        product.stock_status === "sold_out"
      ) {
        toast.error(catalogCopy.soldOutToast, catalogCopy.itemUnavailableTitle);
        return;
      }
      const currentItem = cartRef.current.find(
        (item) => item.product.id === product.id,
      );
      if (
        currentItem &&
        currentItem.quantity + (currentItem.reward_quantity ?? 0) >=
          product.quantity_available
      ) {
        toast.info(
          catalogCopy.cartLimitMessage(product.quantity_available),
          catalogCopy.cartLimitTitle,
        );
        return;
      }

      setSelectedProductId(product.id);
      window.clearTimeout(selectedFeedbackTimerRef.current);
      selectedFeedbackTimerRef.current = window.setTimeout(() => {
        setSelectedProductId((current) =>
          current === product.id ? null : current,
        );
      }, 650);
      setCart((prevCart) => {
        const existingIndex = prevCart.findIndex(
          (item) => item.product.id === product.id,
        );
        if (existingIndex > -1) {
          const nextQty = prevCart[existingIndex].quantity + 1;
          if (
            nextQty + (prevCart[existingIndex].reward_quantity ?? 0) >
            product.quantity_available
          )
            return prevCart;
          const nextCart = [...prevCart];
          nextCart[existingIndex] = {
            ...nextCart[existingIndex],
            quantity: nextQty,
          };
          return normalizePromotionRewards(nextCart, promotion);
        }
        return normalizePromotionRewards(
          [...prevCart, { product, quantity: 1 }],
          promotion,
        );
      });

      if (event) animateAdd(product, event);
    },
    [animateAdd, catalogCopy, promotion, setCart, toast],
  );

  const handleUpdateCartQuantity = useCallback(
    (productId: string, quantity: number) => {
      setCart((prevCart) =>
        normalizePromotionRewards(
          prevCart.map((item) => {
            if (item.product.id === productId) {
              const maxQty = Math.max(
                0,
                item.product.quantity_available - (item.reward_quantity ?? 0),
              );
              const newQty = Math.min(maxQty, Math.max(0, quantity));
              return { ...item, quantity: newQty };
            }
            return item;
          }),
          promotion,
        ),
      );
    },
    [promotion, setCart],
  );

  const handleAddReward = useCallback(
    (product: Product) => {
      setCart((current) => {
        const pricing = calculateCartPricing(current, promotion);
        if (pricing.availableRewardQuantity <= 0) return current;
        const index = current.findIndex(
          (item) => item.product.id === product.id,
        );
        if (index >= 0) {
          const item = current[index];
          if (
            item.quantity + (item.reward_quantity ?? 0) >=
            product.quantity_available
          )
            return current;
          const next = [...current];
          next[index] = {
            ...item,
            product,
            reward_quantity: (item.reward_quantity ?? 0) + 1,
          };
          return normalizePromotionRewards(next, promotion);
        }
        return normalizePromotionRewards(
          [...current, { product, quantity: 0, reward_quantity: 1 }],
          promotion,
        );
      });
    },
    [promotion, setCart],
  );

  useEffect(() => {
    if (rewardProducts.length !== 1) return;
    const pricing = calculateCartPricing(cart, promotion);
    if (pricing.availableRewardQuantity <= 0) return;
    handleAddReward(rewardProducts[0]);
  }, [cart, handleAddReward, promotion, rewardProducts]);

  const handleRemoveFromCart = useCallback(
    (productId: string) => {
      setCart((prevCart) =>
        normalizePromotionRewards(
          prevCart.filter((item) => item.product.id !== productId),
          promotion,
        ),
      );
      setSelectedProductId((current) =>
        current === productId ? null : current,
      );
    },
    [promotion, setCart],
  );

  const handleClearCart = useCallback(() => {
    setCart([]);
    setSelectedProductId(null);
    setIsCartExpanded(false);
  }, [setCart]);

  const handleResetFilters = useCallback(() => {
    setActiveCategory("All");
    setSearchQuery("");
  }, []);

  const handleRetryCatalog = useCallback(() => {
    void loadCatalog();
  }, [loadCatalog]);

  const handleLoadMore = useCallback(() => {
    void loadMore();
  }, [loadMore]);

  const handleToggleCartExpand = useCallback(() => {
    setIsCartExpanded((current) => !current);
  }, []);

  const handleRevealCart = useCallback(() => {
    if (window.matchMedia("(max-width: 760px)").matches) {
      setIsCartExpanded(true);
      return;
    }
    cartModuleRef.current?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      block: "center",
    });
  }, []);

  const openPaymentFlow = useCallback(
    (waitFor?: Promise<void>) => {
      const cachedPayment = loadCatalogSnapshot(catalogShopId)?.payment;
      if (!online && !hasUsablePayment(cachedPayment)) {
        toast.info(
          catalogCopy.cartSavedOffline,
          catalogCopy.reconnectCheckoutTitle,
        );
        return;
      }
      void Promise.all([ensurePayment(), waitFor ?? Promise.resolve()])
        .then(([nextPayment]) => {
          if (!hasUsablePayment(nextPayment)) {
            toast.error(catalogCopy.paymentSettingsError);
            return;
          }
          setPaymentModalRequested(true);
          setIsQrOpen(true);
        })
        .catch((err) => {
          toast.error(
            getUserFacingErrorMessage(err, catalogCopy.paymentSettingsError),
          );
        });
    },
    [catalogCopy, catalogShopId, ensurePayment, online, toast],
  );

  const handleOpenPayment = useCallback(() => {
    if (!orderingEnabled) {
      toast.info(
        catalogCopy.demoCheckoutMessage,
        catalogCopy.demoCheckoutTitle,
      );
      return;
    }
    const closingMobileSheet =
      isCartExpanded && window.matchMedia("(max-width: 760px)").matches;
    setIsCartExpanded(false);
    const sheetExit = closingMobileSheet
      ? new Promise<void>((resolve) => window.setTimeout(resolve, 260))
      : Promise.resolve();
    openPaymentFlow(sheetExit);
  }, [
    catalogCopy,
    isCartExpanded,
    openPaymentFlow,
    orderingEnabled,
    toast,
  ]);

  const categories = useMemo(
    () => ["All", ...catalogCategories],
    [catalogCategories],
  );

  const storefrontOrder = useMemo<StorefrontSection[]>(() => {
    const fallback: StorefrontSection[] = [
      "featured",
      "booth",
      "controls",
      "products",
      "cart",
    ];
    const saved = layoutOrderSchema.safeParse(booth.layout_order);
    return saved.success ? saved.data : fallback;
  }, [booth.layout_order]);

  const storefrontBlocks = useMemo<Record<StorefrontSection, React.ReactNode>>(
    () => ({
      featured: (
        <StackedFeatured
          products={featuredProducts}
          onSelect={handleAddToCart}
          autoRotate={!lightweightMode && (booth.featured_autoplay ?? true)}
        />
      ),
      controls: (
        <div
          className="catalog-controls"
          onClick={(event) => event.stopPropagation()}
        >
          <CategoryFilters
            categories={categories}
            activeCategory={activeCategory}
            onChange={setActiveCategory}
          />
          <CatalogToolbar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            sort={sort}
            viewMode={viewMode}
            onSortChange={setSort}
            onViewModeChange={setViewMode}
          />
        </div>
      ),
      products: (
        <ProductGrid
          products={products}
          totalProducts={products.length + (hasMore ? 1 : 0)}
          activeCategory={activeCategory}
          selectedProduct={products.find((p) => p.id === selectedProductId)}
          viewMode={viewMode}
          onSelect={handleAddToCart}
          onViewDetails={setDetailProduct}
          onResetFilters={handleResetFilters}
          loading={isLoading}
          error={loadError}
          onRetry={handleRetryCatalog}
          searchActive={Boolean(searchQuery.trim())}
          hasMore={hasMore}
          loadingMore={isLoadingMore}
          onLoadMore={handleLoadMore}
        />
      ),
      booth: <BoothInfoPanel booth={booth} />,
      cart: (
        <SelectedItemPanel
          cart={cart}
          promotion={promotion}
          rewardProducts={rewardProducts}
          onAddReward={handleAddReward}
          onQuantityChange={handleUpdateCartQuantity}
          onRemove={handleRemoveFromCart}
          onOpenPayment={handleOpenPayment}
          onClearCart={handleClearCart}
          checkoutLabel={orderingEnabled ? undefined : catalogCopy.demoCheckout}
          isExpanded={isCartExpanded}
          onToggleExpand={handleToggleCartExpand}
        />
      ),
    }),
    [
      activeCategory,
      booth,
      cart,
      catalogCopy,
      categories,
      featuredProducts,
      handleAddReward,
      handleAddToCart,
      handleClearCart,
      handleLoadMore,
      handleOpenPayment,
      handleRemoveFromCart,
      handleResetFilters,
      handleRetryCatalog,
      handleToggleCartExpand,
      handleUpdateCartQuantity,
      hasMore,
      isCartExpanded,
      isLoading,
      isLoadingMore,
      lightweightMode,
      loadError,
      orderingEnabled,
      products,
      promotion,
      rewardProducts,
      searchQuery,
      selectedProductId,
      sort,
      viewMode,
    ],
  );
  const cartPricing = useMemo(
    () => calculateCartPricing(cart, promotion),
    [cart, promotion],
  );
  const cartItemCount = cartPricing.lines.reduce(
    (sum, line) => sum + line.quantity,
    0,
  );
  const handleOrderChange = useCallback(
    (nextOrder: Order | null) => {
      if (!activeOrderRef.current && nextOrder?.status === "pending")
        handleClearCart();
      activeOrderRef.current = nextOrder;
      setActiveOrder(nextOrder);
    },
    [handleClearCart],
  );

  const heroStorefrontSections = storefrontOrder.filter(
    (section) => section === "featured" || section === "booth",
  );
  const mainStorefrontSections = storefrontOrder.filter(
    (section) => section === "controls" || section === "products",
  );
  const sideStorefrontSections = storefrontOrder.filter(
    (section) => section === "cart",
  );
  const contentStorefrontColumns = [
    {
      key: "main",
      position:
        mainStorefrontSections.reduce(
          (sum, section) => sum + storefrontOrder.indexOf(section),
          0,
        ) / mainStorefrontSections.length,
      node: (
        <section key="main" className="storefront-content-main">
          {mainStorefrontSections.map((section) => (
            <div
              className={`storefront-module storefront-module-${section} ${getStorefrontSectionStyleClass(section, booth)}`}
              key={section}
            >
              {storefrontBlocks[section]}
            </div>
          ))}
        </section>
      ),
    },
    {
      key: "side",
      position: storefrontOrder.indexOf("cart") - 0.01,
      node: (
        <section
          key="side"
          className="storefront-content-side"
          onClick={(event) => event.stopPropagation()}
        >
          {sideStorefrontSections.map((section) => (
            <div
              className={`storefront-module storefront-module-${section} ${getStorefrontSectionStyleClass(section, booth)}`}
              key={section}
              ref={cartModuleRef}
            >
              {storefrontBlocks[section]}
            </div>
          ))}
        </section>
      ),
    },
  ].sort((first, second) => first.position - second.position);

  if (shop === undefined) {
    return (
      <PageLoading
        title={catalogCopy.openingShop}
        message={catalogCopy.openingShopHint}
      />
    );
  }
  if (shop === null)
    return (
      <CatalogLocaleProvider locale={booth.catalog_locale ?? "en"}>
        <CatalogToastLocalization />
        <ShopUnavailablePage
          hasLoadError={Boolean(shopLoadError)}
          showDemoLink={shopSlug !== "demo-booth"}
          onRetry={() => void loadShop()}
        />
      </CatalogLocaleProvider>
    );

  if (isInitialLoading) {
    return (
      <PageLoading
        title={catalogCopy.openingShop}
        message={catalogCopy.openingShopHint}
      />
    );
  }

  const pendingOrder =
    orderingEnabled && activeOrder?.status === "pending" ? activeOrder : null;
  const showPendingOrderDock = Boolean(pendingOrder && !isQrOpen);
  const reserveFloatingCartSpace = cart.length > 0 && !activeOrder;
  const showFloatingCartDock =
    isFloatingCartVisible && reserveFloatingCartSpace;
  const storefrontDockClasses = `${showPendingOrderDock ? " storefront-has-order-dock" : ""}${reserveFloatingCartSpace ? " storefront-has-cart-dock" : ""}`;

  return (
    <CatalogLocaleProvider locale={booth.catalog_locale ?? "en"}>
      <CatalogToastLocalization />
      <PromotionProvider promotion={promotion}>
        <ErrorBoundary
          title={catalogCopy.crashTitle}
          message={catalogCopy.crashHint}
          reloadLabel={catalogCopy.crashReload}
          resetKey={shopSlug}
        >
          <main
            className={`app-shell${lightweightMode ? " catalog-lightweight" : ""}${storefrontDockClasses}`}
            style={getThemeStyle(booth)}
            onClick={() => setSelectedProductId(null)}
          >
            <CatalogHeader
              booth={booth}
              showGacha={gachaEnabled}
              onPrepareGacha={prepareGacha}
              onOpenInfo={() => setIsInfoOpen(true)}
            />
            {!online && (
              <div className="offline-status-banner" role="alert">
                <CloudOff size={15} />
                <span>
                  <strong>{catalogCopy.offlineTitle}</strong>{" "}
                  {catalogCopy.offlineHint}
                </span>
              </div>
            )}
            <div className="catalog-layout storefront-layout-grid">
              <div className="storefront-hero-grid">
                {heroStorefrontSections.map((section) => (
                  <div
                    className={`storefront-module storefront-module-${section} ${getStorefrontSectionStyleClass(section, booth)}`}
                    key={section}
                    onClick={
                      section === "booth"
                        ? (event) => event.stopPropagation()
                        : undefined
                    }
                  >
                    {storefrontBlocks[section]}
                  </div>
                ))}
              </div>
              <div className="storefront-content-grid">
                {contentStorefrontColumns.map((column) => column.node)}
              </div>
            </div>
            {showPendingOrderDock && pendingOrder && (
              <PendingOrderBar
                order={pendingOrder}
                style={getThemeStyle(booth)}
                onOpen={() => openPaymentFlow()}
              />
            )}
            {showFloatingCartDock && (
              <FloatingCartBar
                itemCount={cartItemCount}
                total={cartPricing.total}
                style={getThemeStyle(booth)}
                onOpen={handleRevealCart}
              />
            )}
            {orderingEnabled && paymentModalRequested && (
              <Suspense fallback={null}>
                <PaymentQrModal
                  shopSlug={shop.slug}
                  isOpen={isQrOpen}
                  payment={payment}
                  cart={cart}
                  promotion={promotion}
                  booth={booth}
                  onClose={() => setIsQrOpen(false)}
                  onSuccess={() => void loadCatalog()}
                  onOrderChange={handleOrderChange}
                />
              </Suspense>
            )}
            <ProductDetailModal
              product={detailProduct}
              onClose={() => {
                setDetailProduct(null);
                setSelectedProductId(null);
              }}
              onAddToCart={handleAddToCart}
            />
            <BoothDetailsModal
              booth={booth}
              payment={payment}
              open={isInfoOpen}
              onClose={() => setIsInfoOpen(false)}
            />
            <FlyingItemsLayer items={flyingItems} />
          </main>
        </ErrorBoundary>
      </PromotionProvider>
    </CatalogLocaleProvider>
  );
}
