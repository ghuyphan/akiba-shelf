import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { defaultBooth } from "../lib/constants";
import { getCatalogCoreData } from "../lib/api/catalog";
import { getPublicProductsByIds } from "../lib/api/products";
import { getErrorMessage, isSessionNoise } from "../lib/errors";
import {
  loadCatalogSnapshot,
  replaceCompleteCatalogSnapshot,
  saveCatalogSnapshot,
} from "../lib/offline/offline";
import { subscribeToCatalogChanges } from "../lib/realtime";
import type { CartItem, Product, StorefrontBootstrap } from "../types/catalog";
import { useCatalogProducts, type CatalogQuery } from "./useCatalogProducts";
import { useStorefrontBootstrap } from "./useStorefrontBootstrap";
import { OFFLINE_EVENT_UPDATED } from "../lib/offline/offlineEvents";
import { translations } from "../lib/i18n/catalogI18n";
import { calculateCartPricing } from "../utils/pricing";

const EMPTY_PRODUCTS: Product[] = [];

type ProductsLoadedHandler = (
  products: Product[],
  authoritativeIds?: string[],
) => void;

export function useCatalogData(
  shopId: string | undefined,
  shopSlug: string,
  query: CatalogQuery,
  cart: CartItem[],
  onProductsLoaded: ProductsLoadedHandler,
  paymentEnabled = true,
  initialBootstrap: StorefrontBootstrap | null | undefined = undefined,
) {
  const cached = useMemo(() => loadCatalogSnapshot(shopId), [shopId]);
  const initialProducts = cached?.products ?? EMPTY_PRODUCTS;
  const initialBooth = cached?.booth ?? defaultBooth;
  const [cartError, setCartError] = useState("");
  const [refreshError, setRefreshError] = useState("");
  const [rewardProducts, setRewardProducts] = useState<Product[]>([]);
  const rewardProductsRef = useRef<Product[]>([]);
  const storefront = useStorefrontBootstrap(
    shopId,
    shopSlug,
    paymentEnabled,
    initialBooth,
    initialProducts,
    cached?.payment,
    cached?.promotion,
    cached?.categories,
    initialBootstrap,
  );
  const productCatalog = useCatalogProducts(
    shopId,
    query,
    initialProducts,
    onProductsLoaded,
    {
      pending: storefront.isInitialLoading,
      page: storefront.initialProductPage,
    },
  );
  const gachaEnabled = storefront.gachaEnabled ?? cached?.gachaEnabled ?? false;
  const cartProductIds = useMemo(
    () => cart.map((item) => item.product.id),
    [cart],
  );
  const cartProductKey = cartProductIds.join("\u0000");
  const rewardSelectionAvailable =
    calculateCartPricing(cart, storefront.promotion).availableRewardQuantity >
    0;
  const reloadProducts = productCatalog.reload;
  const refreshVisibleProducts = productCatalog.refreshVisible;
  const reloadStorefront = storefront.reload;
  const refreshProductMetadata = storefront.refreshProductMetadata;
  const refreshBooth = storefront.refreshBooth;
  const refreshPayment = storefront.refreshPayment;
  const refreshPromotion = storefront.refreshPromotion;
  const liveRefreshError =
    translations[storefront.booth.catalog_locale ?? "en"].liveRefreshFailed;

  useEffect(() => {
    if (!shopId) return;
    const refreshEventStock = (event: Event) => {
      const detail = (event as CustomEvent<{ shopId?: string }>).detail;
      if (!detail?.shopId || detail.shopId === shopId) void reloadProducts();
    };
    window.addEventListener(OFFLINE_EVENT_UPDATED, refreshEventStock);
    return () =>
      window.removeEventListener(OFFLINE_EVENT_UPDATED, refreshEventStock);
  }, [reloadProducts, shopId]);

  const refreshCompleteOfflineSnapshot = useCallback(async () => {
    if (!shopId || loadCatalogSnapshot(shopId)?.complete !== true) return;
    try {
      const completeCatalog = await getCatalogCoreData(shopId);
      replaceCompleteCatalogSnapshot(completeCatalog, shopId);
    } catch {
      // Keep the last complete snapshot when a background reconciliation fails.
    }
  }, [shopId]);

  // Latest-value refs keep the Realtime channel lifetime tied to shopId only:
  // the subscription effect reads these instead of closing over props/state
  // that change on every cart edit or catalog query change.
  const cartProductIdsRef = useRef(cartProductIds);
  cartProductIdsRef.current = cartProductIds;
  const loadedProductsRef = useRef(initialProducts);
  loadedProductsRef.current = productCatalog.products;

  const loadCartProducts = useCallback(
    async ({ forceRefresh = false }: { forceRefresh?: boolean } = {}) => {
      const requestedIds = [...cartProductIdsRef.current];
      if (!shopId || requestedIds.length === 0) {
        setCartError("");
        return;
      }
      try {
        // Reconcile from the already-loaded product list where possible and
        // only fetch the ids missing from that cache (e.g. filtered out by
        // the current category/search). Realtime stock changes and manual
        // reloads bypass the cache to stay server-authoritative.
        const cached = new Map(
          loadedProductsRef.current.map((product) => [product.id, product]),
        );
        const missingIds = forceRefresh
          ? requestedIds
          : requestedIds.filter((id) => !cached.has(id));
        const fetched = missingIds.length
          ? await getPublicProductsByIds(shopId, missingIds)
          : [];
        const fetchedById = new Map(
          fetched.map((product) => [product.id, product]),
        );
        const nextProducts = requestedIds.flatMap((id) => {
          const product = cached.get(id) ?? fetchedById.get(id);
          return product ? [product] : [];
        });
        onProductsLoaded(nextProducts, requestedIds);
        setCartError("");
      } catch (error) {
        if (!isSessionNoise(error))
          setCartError(getErrorMessage(error, "Could not refresh your cart."));
      }
    },
    [onProductsLoaded, shopId],
  );

  const reloadAll = useCallback(async () => {
    await Promise.all([
      reloadProducts(),
      reloadStorefront(),
      loadCartProducts({ forceRefresh: true }),
      refreshCompleteOfflineSnapshot(),
    ]);
    setRefreshError("");
  }, [
    loadCartProducts,
    refreshCompleteOfflineSnapshot,
    reloadProducts,
    reloadStorefront,
  ]);

  useEffect(() => {
    void loadCartProducts();
  }, [cartProductKey, loadCartProducts]);

  useEffect(() => {
    if (
      !shopId ||
      !rewardSelectionAvailable ||
      storefront.promotion.reward_product_ids.length === 0
    ) {
      rewardProductsRef.current = [];
      setRewardProducts([]);
      return;
    }
    const rewardIds = storefront.promotion.reward_product_ids;
    const availableById = new Map(
      [
        ...initialProducts,
        ...productCatalog.products,
        ...rewardProductsRef.current,
      ].map((product) => [product.id, product]),
    );
    const resolvedProducts = rewardIds.flatMap((id) => {
      const product = availableById.get(id);
      return product ? [product] : [];
    });
    rewardProductsRef.current = resolvedProducts;
    setRewardProducts(resolvedProducts);
    const missingIds = rewardIds.filter((id) => !availableById.has(id));
    if (missingIds.length === 0) return;
    let active = true;
    void getPublicProductsByIds(shopId, missingIds)
      .then((next) => {
        if (!active) return;
        const fetchedById = new Map(
          next.map((product) => [product.id, product]),
        );
        const merged = rewardIds.flatMap((id) => {
          const product = availableById.get(id) ?? fetchedById.get(id);
          return product ? [product] : [];
        });
        rewardProductsRef.current = merged;
        setRewardProducts(merged);
      })
      .catch(() => {
        if (active) {
          rewardProductsRef.current = resolvedProducts;
          setRewardProducts(resolvedProducts);
        }
      });
    return () => {
      active = false;
    };
  }, [
    initialProducts,
    productCatalog.products,
    rewardSelectionAvailable,
    shopId,
    storefront.promotion.reward_product_ids,
  ]);

  useEffect(() => {
    if (
      !shopId ||
      productCatalog.isLoading ||
      productCatalog.isInitialLoading ||
      storefront.isInitialLoading
    )
      return;
    saveCatalogSnapshot(
      {
        products: productCatalog.products,
        booth: storefront.booth,
        payment: storefront.paymentResolved ? storefront.payment : undefined,
        promotion: storefront.promotion,
        categories: storefront.categories,
        gachaEnabled,
      },
      shopId,
    );
  }, [
    productCatalog.isInitialLoading,
    productCatalog.isLoading,
    productCatalog.products,
    shopId,
    gachaEnabled,
    storefront.booth,
    storefront.categories,
    storefront.isInitialLoading,
    storefront.payment,
    storefront.paymentResolved,
    storefront.promotion,
  ]);

  const realtimeHandlersRef = useRef({
    loadCartProducts,
    refreshBooth,
    refreshPayment,
    refreshPromotion,
    refreshProductMetadata,
    refreshVisibleProducts,
  });
  realtimeHandlersRef.current = {
    loadCartProducts,
    refreshBooth,
    refreshPayment,
    refreshPromotion,
    refreshProductMetadata,
    refreshVisibleProducts,
  };

  useEffect(() => {
    const timers = new Map<string, number>();
    if (!shopId) return;
    const unsubscribe = subscribeToCatalogChanges(shopId, {
      onChange: (table) => {
        window.clearTimeout(timers.get(table));
        timers.set(
          table,
          window.setTimeout(() => {
            const handlers = realtimeHandlersRef.current;
            const request =
              table === "products"
                ? Promise.all([
                    handlers.refreshVisibleProducts(),
                    handlers.refreshProductMetadata(),
                    handlers.loadCartProducts({ forceRefresh: true }),
                    refreshCompleteOfflineSnapshot(),
                  ])
                : table === "booth_settings"
                  ? handlers.refreshBooth()
                  : table === "payment_settings"
                    ? handlers.refreshPayment()
                    : handlers.refreshPromotion();
            void request
              .then(() => setRefreshError(""))
              .catch((error: unknown) => {
                if (!isSessionNoise(error))
                  setRefreshError(getErrorMessage(error, liveRefreshError));
              });
          }, 150),
        );
      },
    });
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      unsubscribe();
    };
  }, [liveRefreshError, refreshCompleteOfflineSnapshot, shopId]);

  return {
    products: productCatalog.products,
    featuredProducts: storefront.featuredProducts,
    categories: storefront.categories,
    booth: storefront.booth,
    payment: storefront.payment,
    promotion: storefront.promotion,
    rewardProducts,
    hasMore: productCatalog.hasMore,
    loadError:
      productCatalog.error || storefront.error || cartError || refreshError,
    isLoading: productCatalog.isLoading,
    isInitialLoading:
      (productCatalog.isInitialLoading || storefront.isInitialLoading) &&
      !cached,
    isLoadingMore: productCatalog.isLoadingMore,
    loadMore: productCatalog.loadMore,
    reloadAll,
    ensurePayment: storefront.ensurePayment,
    gachaEnabled,
  };
}
